# VulApp - Deliberately Vulnerable SaaS Platform

VulApp is a simple SaaS platform built for security testing, manual pentesting, and automated scanning. It contains 10+ intentional security vulnerabilities across authentication, authorization, injection, and business logic.

## 🚀 Quick Start (Docker)

Ensure you have Docker and Docker Compose installed.

1.  **Clone and Start**:
    ```bash
    docker-compose up --build
    ```
2.  **Access the App**:
    - Frontend: [http://localhost:5173](http://localhost:5173)
    - Backend API: [http://localhost:5001/api](http://localhost:5001/api)

## 👤 Test Credentials

- **Email**: `test@example.com`
- **Password**: `123456`

## 🛡️ Vulnerability Inventory

### 1. Broken Authentication & Authorization
- **Weak JWT Secret**: The backend uses `secret123` as the JWT signing key.
- **IDOR (Insecure Direct Object Reference)**: Access any project by its ID via `GET /api/projects/:id` without ownership validation.
- **Missing Rate Limiting**: `/api/auth/login` and `/api/auth/register` are vulnerable to brute-force attacks.

### 2. Injection
- **SQL Injection**: The search endpoint `GET /api/projects/search/name?name=` uses raw string concatenation.
  - *Payload Example*: `' OR '1'='1`
- **Stored XSS (Cross-Site Scripting)**: Project descriptions allow raw HTML and are rendered without sanitization using `dangerouslySetInnerHTML`.
  - *Payload Example*: `<img src=x onerror=alert(1)>`

### 3. Insecure File Handling
- **Unrestricted File Upload**: No validation on file extensions or MIME types.
- **Direct File Execution**: Uploaded files (including `.html` or `.js`) are served directly from `/uploads`.

### 4. Business Logic Errors
- **Subscription Bypass**: Users can upgrade their `plan_type` to `pro` or `enterprise` by directly sending the value to `POST /api/subscribe`.

### 5. Sensitive Data Exposure & SSRF
- **Debug Endpoint**: `GET /api/debug` leaks the database path, JWT secret, and environment variables.
- **Server-Side Request Forgery (SSRF)**: `GET /api/fetch-url?url=` allows the server to fetch any internal or external URL.

### 6. Misconfiguration
- **CORS Misconfiguration**: `Access-Control-Allow-Origin` is set to `*`.
- **Sensitive Error Details**: Full stack traces are returned in 500 responses.

## 🛠️ API Examples (CURL)

**Login**:
```bash
curl -X POST http://localhost:5001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com", "password":"123456"}'
```

**SQL Injection Search**:
```bash
curl "http://localhost:5001/api/projects/search/name?name='%20OR%20'1'='1"
```

**SSRF**:
```bash
curl "http://localhost:5001/api/fetch-url?url=https://www.google.com"
```

## 🛠️ Troubleshooting (Docker Issues)

If you encounter an "invalid ELF header" error or Node version issues:
1.  **Clean Up**:
    ```bash
    docker-compose down -v
    rm -rf backend/node_modules frontend/node_modules
    ```
2.  **Rebuild**:
    ```bash
    docker-compose up --build
    ```
This ensures host-specific binaries (like macOS `sqlite3`) don't conflict with the Linux container environment.
