import express from 'express';import helmet from 'helmet';import {rateLimit} from 'express-rate-limit';import {randomBytes,scryptSync,timingSafeEqual,createHash,randomUUID} from 'node:crypto';import {schedule,priority} from './scheduler.mjs';import {AIService} from './ai.mjs';import {mediaInfo,optionalMediaUrl,smartOrder,isDueToday} from './feed.mjs';import {demoContents} from './feed-demo.mjs';
export function createRemoteApp(db) {
    const app = express(), ai = new AIService();
    app.set('trust proxy', 1);
    app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    app.use(helmet({ referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, crossOriginEmbedderPolicy: false, contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:", 'https:', 'http:'], mediaSrc: ["'self'", 'https:', 'http:'], frameSrc: ['https://www.youtube-nocookie.com', 'https://www.youtube.com', 'https://www.tiktok.com'] } } }));
    app.use(express.json({ limit: '100kb' }));
    app.use('/api', rateLimit({ windowMs: 60000, limit: 180 }));
    app.use('/api/auth', rateLimit({ windowMs: 900000, limit: 40 }));
    app.get('/api/health', async (req, res) => { await db.prepare('SELECT 1 AS ok').get(); res.json({ ok: true }); });
    app.use('/api/auth', async (req, res, next) => { const time = Date.now(), bucket = Math.floor(time / 900000), key = createHash('sha256').update(String(req.headers['x-nf-client-connection-ip'] || req.ip) + ':' + bucket).digest('hex'); const counter = await db.prepare('INSERT INTO auth_rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=auth_rate_limits.count+1 RETURNING count').get(key, new Date(time + 900000).toISOString()); if (counter.count > 40)
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos para tentar novamente.' }); next(); });
    const now = () => new Date().toISOString(), hash = t => createHash('sha256').update(t).digest('hex');
    const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
    function password(p) { if (typeof p !== 'string' || p.length < 10 || p.length > 200)
        fail('Use uma senha de 10 a 200 caracteres.'); const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(p, salt, 64).toString('hex'); }
    async function session(res, id) { const token = randomBytes(32).toString('hex'); await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(hash(token), id, new Date(Date.now() + 30 * 86400000).toISOString()); res.cookie('session', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production' || process.env.NETLIFY === 'true', maxAge: 30 * 86400000, path: '/' }); }
    function pack(c) { const analysis = c.analysis ? JSON.parse(c.analysis) : null; return { ...c, analysis, tags: JSON.parse(c.tags || '[]'), favorite: !!c.favorite, demo: !!c.demo, source_url: c.url, transcription: c.transcript, translation: analysis?.translation || '', description: c.description || analysis?.summary || '', difficulty: analysis?.difficulty || 2, review_count: c.reviews, thumbnail: c.thumbnail_url }; }
    app.post('/api/auth/register', async (req, res) => { const email = String(req.body.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail('Informe um e-mail válido.'); const name = String(req.body.name || '').trim(); if (!name || name.length > 100)
        fail('Informe seu nome.'); if (await db.prepare('SELECT id FROM users WHERE email=?').get(email))
        fail('Este e-mail já possui uma conta.', 409); const id = randomUUID(); await db.prepare('INSERT INTO users VALUES (?,?,?,?,?)').run(id, email, password(req.body.password), JSON.stringify({ name, level: 'A2', goal: 'Conversação', daily: 10, minutes: 10, onboarded: false }), now()); await session(res, id); res.json({ ok: true }); });
    app.post('/api/auth/login', async (req, res) => { const u = await db.prepare('SELECT * FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase()); if (!u || typeof req.body.password !== 'string' || req.body.password.length > 200)
        fail('E-mail ou senha incorretos.', 401); const [salt, key] = u.password.split(':'); if (!timingSafeEqual(Buffer.from(key, 'hex'), scryptSync(req.body.password, salt, 64)))
        fail('E-mail ou senha incorretos.', 401); await session(res, u.id); res.json({ ok: true }); });
    app.post('/api/auth/forgot', async (req, res) => { if (!process.env.RESET_WEBHOOK_URL)
        fail('Recuperação por e-mail ainda não configurada pelo administrador.', 503); const u = await db.prepare('SELECT id FROM users WHERE email=?').get(String(req.body.email || '').trim().toLowerCase()); if (u) {
        const token = randomBytes(32).toString('hex');
        await db.prepare('INSERT INTO resets VALUES (?,?,?)').run(hash(token), u.id, new Date(Date.now() + 3600000).toISOString());
        const delivery = await fetch(process.env.RESET_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: req.body.email, token }), signal: AbortSignal.timeout(10000) });
        if (!delivery.ok)
            fail('Serviço de e-mail indisponível.', 503);
    } res.json({ message: 'Se a conta existir, você receberá as instruções.' }); });
    app.post('/api/auth/reset', async (req, res) => { const r = await db.prepare('SELECT * FROM resets WHERE token=? AND expires>?').get(hash(String(req.body.token)), now()); if (!r)
        fail('Código inválido ou expirado.'); const p = password(req.body.password); await db.prepare('UPDATE users SET password=? WHERE id=?').run(p, r.user_id); await db.prepare('DELETE FROM resets WHERE user_id=?').run(r.user_id); await db.prepare('DELETE FROM sessions WHERE user_id=?').run(r.user_id); res.json({ ok: true }); });
    app.use('/api', async (req, res, next) => { const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8); const s = token && await db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(hash(token), now()); if (!s)
        return res.status(401).json({ error: 'Entre na sua conta para continuar.' }); req.uid = s.user_id; next(); });
    app.post('/api/auth/logout', async (req, res) => { const token = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('session='))?.slice(8); if (token)
        await db.prepare('DELETE FROM sessions WHERE token=?').run(hash(token)); res.clearCookie('session', { path: '/' }); res.json({ ok: true }); });
    app.get('/api/me', async (req, res) => { const u = await db.prepare('SELECT email,profile,created_at FROM users WHERE id=?').get(req.uid); res.json({ ...JSON.parse(u.profile), email: u.email, created_at: u.created_at }); });
    app.patch('/api/me', async (req, res) => { const p = JSON.parse((await db.prepare('SELECT profile FROM users WHERE id=?').get(req.uid)).profile); for (const key of ['name', 'level', 'goal', 'daily', 'minutes', 'onboarded'])
        if (req.body[key] !== undefined)
            p[key] = req.body[key]; if (!String(p.name).trim() || ![5, 10, 15, 20, 30].includes(Number(p.daily)) || ![5, 10, 20, 30, 60].includes(Number(p.minutes)))
        fail('Confira seu nome e suas metas.'); await db.prepare('UPDATE users SET profile=? WHERE id=?').run(JSON.stringify(p), req.uid); res.json(p); });
    const get = async (id, uid) => { const c = await db.prepare('SELECT * FROM contents WHERE id=? AND user_id=?').get(id, uid); if (!c)
        fail('Conteúdo não encontrado.', 404); return pack(c); };
    app.get('/api/contents', async (req, res) => res.json((await db.prepare('SELECT * FROM contents WHERE user_id=?').all(req.uid)).map(pack).sort((a, b) => priority(b) - priority(a))));
    app.get('/api/feed', async (req, res) => { const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12)), offset = Math.max(0, Math.floor(Number(req.query.offset) || 0)), seed = String(req.query.seed || 'flow').slice(0, 100); res.json(await getSmartFeed(db, req.uid, { limit, offset, seed }, pack)); });
    app.get('/api/reviews/today', async (req, res) => res.json((await db.prepare('SELECT * FROM contents WHERE user_id=? AND next_review<=?').all(req.uid, now())).map(pack)));
    app.get('/api/contents/:id', async (req, res) => res.json({ ...await get(req.params.id, req.uid), history: await db.prepare('SELECT * FROM reviews WHERE content_id=? AND user_id=? ORDER BY created_at DESC').all(req.params.id, req.uid) }));
    async function add(uid, b) { let url; try {
        url = new URL(b.url);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
            throw 0;
        url.hash = '';
        for (const key of [...url.searchParams.keys()])
            if (key.startsWith('utm_'))
                url.searchParams.delete(key);
    }
    catch {
        fail('Cole um link HTTP ou HTTPS válido.');
    } const duplicate = await db.prepare('SELECT id FROM contents WHERE user_id=? AND url=?').get(uid, url.href); if (duplicate)
        throw Object.assign(new Error('Você já salvou este conteúdo.'), { status: 409, id: duplicate.id }); const video = optionalMediaUrl(b.video_url), thumbnail = optionalMediaUrl(b.thumbnail_url); const id = randomUUID(); await db.prepare('INSERT INTO contents(id,user_id,url,title,transcript,analysis,category,level,tags,demo,next_review,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id, uid, url.href, String(b.title || url.hostname).slice(0, 200), String(b.transcript || '').slice(0, 30000), null, String(b.category || 'Expressions'), String(b.level || 'A2'), JSON.stringify(String(b.tags || '').split(',').map(t => t.trim()).filter(Boolean)), b.demo ? 1 : 0, now(), now()); const media = mediaInfo(url.href, video); await db.prepare('UPDATE contents SET video_url=?,thumbnail_url=?,description=?,platform=?,content_type=? WHERE id=? AND user_id=?').run(video || (media.content_type === 'video' ? url.href : null), thumbnail, String(b.description || '').slice(0, 1000), media.platform, media.content_type, id, uid); return await get(id, uid); }
    app.post('/api/contents', async (req, res) => res.status(201).json(await add(req.uid, { ...req.body, demo: false })));
    app.patch('/api/contents/:id', async (req, res) => { const c = await get(req.params.id, req.uid); await db.prepare('UPDATE contents SET favorite=? WHERE id=? AND user_id=?').run(req.body.favorite ? 1 : 0, c.id, req.uid); res.json(await get(c.id, req.uid)); });
    app.delete('/api/contents/:id', async (req, res) => { await get(req.params.id, req.uid); await db.prepare('DELETE FROM contents WHERE id=? AND user_id=?').run(req.params.id, req.uid); res.json({ ok: true }); });
    app.post('/api/contents/:id/analyze', async (req, res) => { const c = await get(req.params.id, req.uid); const transcript = String(req.body.transcript || c.transcript).trim(); if (!transcript)
        fail('Não acessamos a transcrição automaticamente. Cole o texto para analisar.'); const a = await ai.analyzeContent({ title: c.title, transcript }); await db.prepare('UPDATE contents SET analysis=?,transcript=?,title=?,level=?,category=? WHERE id=? AND user_id=?').run(JSON.stringify(a), transcript, String(a.title || c.title), String(a.level || c.level), String(a.category || c.category), c.id, req.uid); res.json(await get(c.id, req.uid)); });
    app.post('/api/contents/:id/review', async (req, res) => {
        if (!['forgot', 'partial', 'remembered'].includes(req.body.rating))
            fail('Resposta de revisão inválida.');
        const result = await db.transaction(async (tx) => {
            const raw = await tx.prepare('SELECT * FROM contents WHERE id=? AND user_id=? FOR UPDATE').get(req.params.id, req.uid);
            if (!raw)
                fail('Conteúdo não encontrado.', 404);
            const c = pack(raw), key = typeof req.body.request_key === 'string' ? req.body.request_key.slice(0, 100) : null;
            if (key) {
                const existing = await tx.prepare('SELECT * FROM reviews WHERE user_id=? AND request_key=?').get(req.uid, key);
                if (existing) {
                    if (existing.content_id !== c.id)
                        fail('Identificador de revisão inválido.', 409);
                    return { interval: existing.interval, next_review: new Date(Date.parse(existing.created_at) + existing.interval * 86400000).toISOString(), review_count: c.reviews };
                }
            }
            const r = schedule(c, req.body.rating), reviewedAt = now();
            await tx.prepare('INSERT INTO reviews(id,user_id,content_id,rating,created_at,interval,request_key) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), req.uid, c.id, req.body.rating, reviewedAt, r.interval, key);
            await tx.prepare('UPDATE contents SET step=?,reviews=reviews+1,correct=correct+?,errors=errors+?,next_review=?,last_review=? WHERE id=? AND user_id=?').run(r.step, req.body.rating === 'remembered' ? 1 : 0, req.body.rating === 'forgot' ? 1 : 0, r.next_review, reviewedAt, c.id, req.uid);
            return { ...r, review_count: c.reviews + 1 };
        });
        res.json(result);
    });
    app.get('/api/progress', async (req, res) => { const contents = (await db.prepare('SELECT * FROM contents WHERE user_id=? AND demo=0').all(req.uid)).map(pack); const reviews = await db.prepare('SELECT r.* FROM reviews r JOIN contents c ON c.id=r.content_id WHERE r.user_id=? AND c.demo=0').all(req.uid); const date = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); const days = new Set(reviews.map(r => date(r.created_at))); let streak = 0, d = new Date(); if (!days.has(date(d)))
        d.setDate(d.getDate() - 1); while (days.has(date(d))) {
        streak++;
        d.setDate(d.getDate() - 1);
    } const week = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return { day: d.toLocaleDateString('pt-BR', { weekday: 'short' }), count: reviews.filter(r => date(r.created_at) === date(d)).length }; }); res.json({ saved: contents.length, studied: contents.filter(c => c.reviews > 0).length, reviews: reviews.length, today: reviews.filter(r => date(r.created_at) === date(new Date())).length, due: contents.filter(c => c.next_review <= now()).length, words: new Set(contents.filter(c => c.correct > 0).flatMap(c => (c.analysis?.important_words || []).map(w => w.word))).size, retention: reviews.length ? Math.round(reviews.filter(r => r.rating === 'remembered').length / reviews.length * 100) : 0, mastered: contents.filter(c => c.step >= 4).length, difficult: contents.filter(c => c.errors > c.correct).length, streak, week, categories: [...new Set(contents.map(c => c.category))].map(category => { const cs = contents.filter(c => c.category === category); return { category, value: Math.round(cs.reduce((s, c) => s + (c.reviews ? c.correct / c.reviews : 0), 0) / cs.length * 100) }; }) }); });
    app.post('/api/contents/:id/question', async (req, res) => res.json(await ai.answerQuestion({ content: await get(req.params.id, req.uid), question: String(req.body.question || '').slice(0, 2000) })));
    app.post('/api/exercises/generate', async (req, res) => { const c = await get(req.body.content_id, req.uid); if (!c.transcript)
        fail('Adicione uma transcrição primeiro.'); const p = await ai.generateExercises({ transcript: c.transcript, analysis: c.analysis }); if (!Array.isArray(p.questions) || !p.questions.length || p.questions.some(q => !Array.isArray(q.options) || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length))
        fail('A IA retornou um exercício inválido. Tente novamente.', 502); const id = randomUUID(); await db.prepare('INSERT INTO exercises VALUES(?,?,?,?)').run(id, req.uid, c.id, JSON.stringify(p)); res.json({ id, questions: p.questions.map(({ answer, explanation, ...q }) => q) }); });
    app.post('/api/exercises/:id/answer', async (req, res) => { const e = await db.prepare('SELECT * FROM exercises WHERE id=? AND user_id=?').get(req.params.id, req.uid); if (!e)
        fail('Exercício não encontrado.', 404); const q = JSON.parse(e.payload).questions[req.body.question]; if (!q)
        fail('Questão inválida.'); if (await db.prepare('SELECT id FROM exercise_answers WHERE exercise_id=? AND question=? AND user_id=?').get(e.id, req.body.question, req.uid))
        fail('Esta questão já foi respondida.', 409); const correct = q.answer === req.body.answer; await db.prepare('INSERT INTO exercise_answers VALUES(?,?,?,?,?,?)').run(randomUUID(), req.uid, e.id, req.body.question, correct ? 1 : 0, now()); res.json({ correct, answer: q.answer, explanation: q.explanation }); });
    app.post('/api/demo', async (req, res) => {
        for (const d of demoContents) {
            let c;
            try {
                c = await add(req.uid, { ...d, demo: true, tags: 'Demonstração' });
            }
            catch (e) {
                if (e.status !== 409)
                    throw e;
                c = await get(e.id, req.uid);
                if (!c.demo)
                    continue;
            }
            await db.prepare('UPDATE contents SET title=?,analysis=?,transcript=?,category=?,level=?,video_url=?,thumbnail_url=?,description=?,platform=?,content_type=? WHERE id=? AND user_id=?').run(d.title, JSON.stringify(d.analysis), d.transcript, d.category, d.level, d.video_url, d.thumbnail_url, d.description, 'Demonstração', 'video', c.id, req.uid);
        }
        res.json({ ok: true });
    });
    app.use((err, req, res, next) => { if (!err.status)
        console.error('API error:', err.code || err.name); res.status(err.status || (err.code === '23505' ? 409 : 500)).json({ error: err.status ? err.message : err.code === '23505' ? 'Este registro já existe.' : 'Não foi possível concluir. Tente novamente.', id: err.id }); });
    return app;
}

async function getSmartFeed(db,userId,{limit,offset,seed},pack){
 const all=await db.prepare('SELECT * FROM contents WHERE user_id=?').all(userId),items=all.map(pack),time=new Date().toISOString();
 let snapshot=await db.prepare('SELECT ids FROM feed_sessions WHERE user_id=? AND seed=? AND expires>?').get(userId,seed,time);
 if(!snapshot){const ids=JSON.stringify(smartOrder(items,seed).map(c=>c.id));await db.prepare('INSERT INTO feed_sessions(user_id,seed,ids,expires) VALUES(?,?,?,?) ON CONFLICT(user_id,seed) DO UPDATE SET ids=EXCLUDED.ids,expires=EXCLUDED.expires').run(userId,seed,ids,new Date(Date.now()+3600000).toISOString());snapshot={ids};await db.prepare('DELETE FROM feed_sessions WHERE expires<?').run(time);}
 const byId=new Map(items.map(c=>[c.id,c])),ordered=JSON.parse(snapshot.ids).map(id=>byId.get(id)).filter(Boolean);return {items:ordered.slice(offset,offset+limit),total:ordered.length,due_count:items.filter(c=>isDueToday(c)).length,has_more:offset+limit<ordered.length,next_offset:Math.min(offset+limit,ordered.length),seed};
}
