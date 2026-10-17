"""Generate original silent educational demonstration clips. Requires Pillow and imageio-ffmpeg."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess, tempfile, html
import imageio_ffmpeg

root = Path(__file__).resolve().parents[1] / 'public' / 'demo'
root.mkdir(parents=True, exist_ok=True)
examples = [
 ('get-used-to','Get used to','acostumar-se',"I'm getting used to",'waking up early.','Estou me acostumando','a acordar cedo.','#172c34','#9bd7c0'),
 ('used-to','Used to','costumava','I used to live here.','','Eu costumava morar aqui.','','#28283c','#c7b8ee'),
 ('figure-out','Figure out','descobrir / entender','We need to figure out','the answer.','Precisamos descobrir','a resposta.','#233044','#afc8ef'),
 ('hang-out','Hang out','passar tempo junto',"Let's hang out",'this weekend.','Vamos passar um tempo juntos','neste fim de semana.','#3c2c31','#efc1a8'),
 ('take-care','Take care','cuidar-se','Take care of yourself.','','Cuide de si mesmo.','','#23352c','#bdd6ac'),
]
def font(size,bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',size)
for slug,expression,meaning,line1,line2,pt1,pt2,bg,accent in examples:
    image=Image.new('RGB',(540,960),bg)
    draw=ImageDraw.Draw(image)
    draw.ellipse((180,-220,860,460),outline=accent,width=1)
    draw.ellipse((220,-180,820,420),outline='#46515c',width=1)
    draw.rounded_rectangle((35,95,230,126),radius=6,fill='#ffffff15')
    draw.text((46,101),'CLIPE DIDÁTICO LOCAL',font=font(13,True),fill=accent)
    draw.text((38,196),'ENGLISH IN REAL LIFE',font=font(13,True),fill=accent)
    draw.text((35,230),expression,font=font(57,True),fill='#faf7ff')
    draw.text((38,307),meaning,font=font(22),fill=accent)
    draw.line((38,369,480,369),fill='#67707e',width=1)
    draw.text((38,400),line1,font=font(28),fill='#ffffff')
    draw.text((38,440),line2,font=font(28),fill='#ffffff')
    draw.text((38,497),pt1,font=font(20),fill='#c4c9d2')
    draw.text((38,528),pt2,font=font(20),fill='#c4c9d2')
    draw.text((38,575),'DEMONSTRAÇÃO · SEM ÁUDIO',font=font(11,True),fill=accent)
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960" viewBox="0 0 540 960"><rect width="540" height="960" fill="{bg}"/><circle cx="520" cy="90" r="320" stroke="{accent}" fill="none" opacity=".35"/><g font-family="Segoe UI, sans-serif"><text x="38" y="215" fill="{accent}" font-size="13">DEMONSTRAÇÃO · SEM ÁUDIO</text><text x="35" y="290" fill="white" font-size="56" font-weight="700">{html.escape(expression)}</text><text x="38" y="335" fill="{accent}" font-size="22">{html.escape(meaning)}</text><text x="38" y="430" fill="white" font-size="27">{html.escape(line1)}</text><text x="38" y="470" fill="white" font-size="27">{html.escape(line2)}</text><text x="38" y="525" fill="#c4c9d2" font-size="20">{html.escape(pt1)}</text><text x="38" y="556" fill="#c4c9d2" font-size="20">{html.escape(pt2)}</text></g></svg>'''
    (root/(slug+'.svg')).write_text(svg,encoding='utf-8')
    with tempfile.TemporaryDirectory() as temp:
        png=Path(temp)/'frame.png';image.save(png)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-y','-loglevel','error','-loop','1','-i',str(png),'-vf',"zoompan=z='min(zoom+0.00010,1.025)':d=240:s=540x960:fps=24,format=yuv420p",'-t','10','-c:v','libx264','-preset','fast','-crf','24','-movflags','+faststart','-an',str(root/(slug+'.mp4'))],check=True)
    print('Created',slug)
