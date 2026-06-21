"""
Authentication routes for Kread Insights Backend
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
import jwt
from datetime import datetime, timedelta

from config import settings
from models.database import verify_password, hash_password

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "viewer"


class LoginResponse(BaseModel):
    success: bool
    user: dict
    token: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str


def create_jwt_token(user_id: str, email: str, role: str) -> str:
    """Create a JWT token for the user"""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Login endpoint - validates credentials and returns JWT token"""
    from supabase import create_client, Client

    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Get user by email
    response = supabase.table("users").select("*").eq("email", request.email).execute()

    if not response.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = response.data[0]

    # Verify password
    if not verify_password(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create JWT token
    token = create_jwt_token(user["id"], user["email"], user["role"])

    return LoginResponse(
        success=True,
        user={
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        },
        token=token
    )


@router.post("/register")
async def register(request: RegisterRequest, token: str = None):
    """Register a new user - admin only"""
    from supabase import create_client, Client

    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Verify admin privileges
    if token:
        payload = verify_token(token)
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Only admins can create new users")

        # Check if email already exists
        existing = supabase.table("users").select("id").eq("email", request.email).execute()
        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create user
        hashed_password = hash_password(request.password)
        user_data = {
            "name": request.name,
            "email": request.email,
            "password_hash": hashed_password,
            "role": request.role
        }

        result = supabase.table("users").insert(user_data).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create user")

        return {"success": True, "message": "User created successfully"}

    raise HTTPException(status_code=401, detail="Authorization required")


@router.get("/me")
async def get_current_user(token: str = None):
    """Get current user info from token"""
    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    payload = verify_token(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    response = supabase.table("users").select("id, name, email, role, created_at, updated_at").eq("id", payload["sub"]).execute()

    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    return response.data[0]


@router.post("/validate")
async def validate_token(token: str):
    """Validate a JWT token"""
    payload = verify_token(token)
    return {"valid": True, "user": payload}


@router.put("/change-password")
async def change_password(current_password: str, new_password: str, token: str = None):
    """Change user password"""
    if not token:
        raise HTTPException(status_code=401, detail="Token required")

    payload = verify_token(token)

    from supabase import create_client, Client
    supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

    # Get current user
    response = supabase.table("users").select("*").eq("id", payload["sub"]).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = response.data[0]

    # Verify current password
    if not verify_password(current_password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Update password
    new_hashed = hash_password(new_password)
    supabase.table("users").update({"password_hash": new_hashed, "updated_at": "now()"}).eq("id", user["id"]).execute()

    return {"success": True, "message": "Password updated successfully"}
