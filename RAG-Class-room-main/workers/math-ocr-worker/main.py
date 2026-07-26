import base64,io,os
from fastapi import FastAPI,Header,HTTPException
from pydantic import BaseModel
from PIL import Image
app=FastAPI(title="AI Guru Math OCR")
class Req(BaseModel): imageBase64:str;mimeType:str;page:int;region:dict|None=None
@app.get('/health')
def health():return{'ok':True,'engine':'pix2text'}
@app.post('/v1/equation')
def equation(p:Req,x_ai_guru_secret:str|None=Header(default=None)):
 if os.getenv('MATH_OCR_SHARED_SECRET') and x_ai_guru_secret!=os.getenv('MATH_OCR_SHARED_SECRET'):raise HTTPException(401,'Invalid secret')
 try:
  from pix2text import Pix2Text
  image=Image.open(io.BytesIO(base64.b64decode(p.imageBase64.split(',',1)[-1]))).convert('RGB')
  result=Pix2Text.from_config().recognize_formula(image)
  latex=(result.get('text') or result.get('latex')) if isinstance(result,dict) else str(result)
  if not latex:raise ValueError('No equation recognized')
  return{'latex':latex.strip(),'confidence':result.get('score') if isinstance(result,dict) else None,'engine':'pix2text'}
 except Exception as e:raise HTTPException(422,f'Equation recognition failed: {e}')
