from fastapi import FastAPI

app = FastAPI(title="JD's Wafflory API")


@app.get("/")
def home():
    return {"message": "JD's Wafflory backend is running"}