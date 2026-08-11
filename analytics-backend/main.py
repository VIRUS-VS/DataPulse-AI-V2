from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
import pandas as pd
from google import genai
import os
import io
import json
from dotenv import load_dotenv

# Load environment variables from the local .env file
load_dotenv()

# Initialize FastAPI App & Config CORS
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup (Local SQLite)
DATABASE_URL = "sqlite:///./hackathon.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Request Schemas
class QueryRequest(BaseModel):
    user_prompt: str

class SQLExecutionRequest(BaseModel):
    sql_query: str

# 1. Dynamic File Upload Endpoint (Supports CSV and Excel)
@app.post("/api/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        filename = file.filename.lower()
        
        # Read based on file extension
        if filename.endswith('.csv'):
            df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Only CSV or Excel (.xlsx, .xls) files are supported.")
        
        # Clean column names (lowercase, replace spaces with underscores)
        df.columns = df.columns.str.strip().str.lower().str.replace(' ', '_').str.replace('[^a-z0-9_]', '', regex=True)
        
        # Dynamically create/replace a table named 'uploaded_data' in SQLite
        df.to_sql("uploaded_data", con=engine, if_exists="replace", index=False)
        
        return {"message": "Database successfully connected and structured.", "columns": list(df.columns)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

# 2. Dynamic AI SQL Generation Endpoint (UPDATED FOR JSON RESPONSE)
@app.post("/api/generate-sql")
async def generate_sql(request: QueryRequest):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable not set.")
    
    client = genai.Client(api_key=api_key)
    
    # Dynamically inspect the database to get the current schema
    inspector = inspect(engine)
    schema_context = ""
    for table_name in inspector.get_table_names():
        columns = [f"{col['name']} ({col['type']})" for col in inspector.get_columns(table_name)]
        schema_context += f"Table: {table_name}\nColumns: {', '.join(columns)}\n\n"
    
    if not schema_context:
        raise HTTPException(status_code=400, detail="No database connected. Please upload a file first.")

    # Modified Prompt: Forcing Gemini to return a structured JSON object
    prompt = f"""
    You are an expert SQLite data engineer and data analyst. Given this exact database schema:
    
    {schema_context}
    
    Process this user request: "{request.user_prompt}".
    
    You must return ONLY a valid, raw JSON object. Do not include markdown formatting like ```json or backticks. 
    The JSON must match this exact structure:
    {{
        "sql_query": "The raw SQLite query string",
        "chart_type": "Choose ONE: bar, line, pie, column, or none. (Use 'none' if graphing doesn't make sense for the data)",
        "x_axis": "The exact column name from the query results to map to the X-axis or labels",
        "y_axis": "The exact column name from the query results to map to the Y-axis or values"
    }}
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=prompt,
        )
        
        # Strip any accidental markdown formatting from the response
        clean_response = response.text.replace('```json', '').replace('```', '').strip()
        
        # Parse the string into a Python dictionary
        parsed_data = json.loads(clean_response)
        
        # Return the structured data directly
        return parsed_data
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse AI response into JSON format.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. SQL Execution Endpoint
@app.post("/api/execute-sql")
async def execute_sql(request: SQLExecutionRequest):
    db = SessionLocal()
    try:
        result = db.execute(text(request.sql_query))
        rows = [dict(zip(result.keys(), row)) for row in result.fetchall()]
        db.commit()
        return {"data": rows}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"SQL Execution Error: {str(e)}")
    finally:
        db.close()

# 4. Keep-Alive Ping Endpoint
@app.get("/api/ping")
async def ping():
    return {"status": "awake", "message": "Server is running smoothly."}