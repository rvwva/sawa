"""
Sawa Scoring Microservice — FastAPI
====================================
Internal service called by the Node.js API to compute assessment scores.
Protected by a shared API key (X-Scoring-Key header).
"""

import os
from typing import Dict, Any

from fastapi import FastAPI, HTTPException, Security, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from cbi import score as score_cbi
from pss import score as score_pss
from who5 import score as score_who5
from culture import score as score_culture

app = FastAPI(
    title="Sawa Scoring Service",
    version="1.0.0",
    docs_url="/docs" if os.getenv("NODE_ENV") != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

SCORING_API_KEY = os.getenv("SCORING_SERVICE_API_KEY", "dev-scoring-key")


def _verify_key(x_scoring_key: str = Header(...)) -> None:
    if x_scoring_key != SCORING_API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid scoring key")


class ScoreRequest(BaseModel):
    responses: Dict[str, int]


class ScoreResponse(BaseModel):
    assessment_type: str
    result: Dict[str, Any]


@app.post("/score/cbi", response_model=ScoreResponse)
def score_cbi_endpoint(body: ScoreRequest, _: None = Security(_verify_key)):
    """Score a CBI submission."""
    try:
        result = score_cbi(body.responses)
        return ScoreResponse(assessment_type="CBI", result=result.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/score/pss", response_model=ScoreResponse)
def score_pss_endpoint(body: ScoreRequest, _: None = Security(_verify_key)):
    """Score a PSS-10 submission."""
    try:
        result = score_pss(body.responses)
        return ScoreResponse(assessment_type="PSS", result=result.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/score/who5", response_model=ScoreResponse)
def score_who5_endpoint(body: ScoreRequest, _: None = Security(_verify_key)):
    """Score a WHO-5 submission."""
    try:
        result = score_who5(body.responses)
        return ScoreResponse(assessment_type="WHO5", result=result.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/score/culture", response_model=ScoreResponse)
def score_culture_endpoint(body: ScoreRequest, _: None = Security(_verify_key)):
    """Score a Culture Assessment submission."""
    try:
        result = score_culture(body.responses)
        return ScoreResponse(assessment_type="CULTURE", result=result.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
