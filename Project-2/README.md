# 🏃 FitTrack — Fitness & Health Management System

> A full-stack fitness and health management platform built as a DBMS project using **React, Node.js, Express.js, and Oracle Database**.

---

## 📌 Overview

**FitTrack** is a full-stack fitness and health management application developed as a **Database Management Systems (DBMS) project**.

The system allows users to manage their profiles, record physical activities, monitor health metrics, manage wearable devices, track nutrition and fitness goals, earn achievements, connect with other users, and interact with trainers.

The project demonstrates the integration of a **relational Oracle database** with a modern web application through a REST API.

### Core objectives

- User registration and authentication
- Fitness activity tracking
- Health metric monitoring
- Wearable device management
- Nutrition tracking
- Fitness goal management
- Achievement management
- Trainer and athlete management
- Trainer supervision of activities
- Notification management
- Social following
- Interactive SQL terminal
- Oracle relational database implementation

---

# ✨ Features

## 👤 User Management

- User registration and login
- JWT authentication
- Password hashing using bcrypt
- Profile management
- Phone number management
- User-specific data access

## 🏃 Activity Tracking

Users can record:

- Activity type
- Duration
- Distance
- Activity date

## ❤️ Health Metrics

Users can store:

- Heart rate
- SpO2
- Steps
- Other health measurements

Each health metric is associated with a wearable device.

## ⌚ Wearable Devices

The system supports:

- Smartwatches
- Fitness bands
- Device features

Device information includes:

- Brand
- Model
- Serial number
- Associated user

## 🥗 Nutrition

Users can maintain:

- Meals
- Calories
- Quantity
- Date
- Food items

## 🎯 Goals

Users can create fitness goals with:

- Goal type
- Target value
- Deadline

## 🏆 Achievements

Achievements can be associated with activities using the `EARNS` relationship.

## 🧑‍🏫 Trainers and Athletes

The system supports:

- Trainer profiles
- Athlete profiles
- Trainer supervision
- Session notes
- Performance ratings

## 🔔 Notifications

Users can configure:

- Notification source
- Trainer
- Contact channel
- Notification preference

## 👥 Social

Users can follow other users through the `USER_FOLLOWS` relationship.

## 🖥️ SQL Terminal

The application contains an interactive SQL terminal for:

- SQL queries
- Database exploration
- Table inspection
- CRUD operations
- DBMS demonstrations

---

# 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Node.js |
| API | Express.js |
| Database | Oracle Database 23c Free |
| Oracle Driver | node-oracledb |
| Authentication | JWT |
| Password Hashing | bcryptjs |
| Version Control | Git + GitHub |
| Development | VS Code |
| Optional Distribution | Docker |

---

# 🏗️ System Architecture

```text
┌────────────────────────────────────┐
│            FitTrack UI             │
│             React                  │
│                                    │
│ Dashboard                          │
│ Activities                         │
│ Nutrition                          │
│ Goals                              │
│ Achievements                       │
│ Devices                            │
│ Health Metrics                     │
│ Trainers                           │
│ Notifications                      │
│ Profile                            │
│ Social                             │
│ SQL Terminal                       │
└──────────────────┬─────────────────┘
                   │
                   │ REST API / JSON
                   ▼
┌────────────────────────────────────┐
│         Node.js + Express.js       │
│                                    │
│ Authentication                     │
│ Authorization                      │
│ CRUD APIs                          │
│ Business Logic                     │
│ SQL Terminal API                   │
│ Oracle Connection Pool             │
└──────────────────┬─────────────────┘
                   │
                   │ node-oracledb
                   ▼
┌────────────────────────────────────┐
│          Oracle Database           │
│                                    │
│ 18 Relational Tables               │
│ Primary Keys                       │
│ Foreign Keys                       │
│ Composite Keys                     │
│ Identity Columns                   │
│ Sequence                           │
│ Trigger                            │
└────────────────────────────────────┘
```

---

# 🗄️ Complete Database Schema

FitTrack uses **18 relational tables**.

The following represents the current Oracle database schema.

---

## 1. `USERS`

Stores the main account and profile information.

| Field | Data Type | Key / Description |
|---|---|---|
| `USERID` | NUMBER | Primary Key, Identity |
| `FIRSTNAME` | VARCHAR2(100) | User first name |
| `LASTNAME` | VARCHAR2(100) | User last name |
| `EMAIL` | VARCHAR2(255) | User email |
| `DOB` | DATE | Date of birth |
| `GENDER` | VARCHAR2(20) | Gender |
| `PASSWORD` | VARCHAR2(255) | Hashed password |

**Primary Key:** `USERID`

---

## 2. `USER_PHONE`

Stores user phone numbers.

| Field | Data Type | Key / Description |
|---|---|---|
| `USERID` | NUMBER | Part of Primary Key, Foreign Key |
| `PHONENUMBER` | VARCHAR2(20) | Part of Primary Key |

**Primary Key:** `(USERID, PHONENUMBER)`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

---

## 3. `ATHLETE`

Stores athlete-specific information.

| Field | Data Type | Key / Description |
|---|---|---|
| `USERID` | NUMBER | Primary Key, Foreign Key |
| `SPORTTYPE` | VARCHAR2(100) | Sport type |
| `SKILLLEVEL` | VARCHAR2(50) | Skill level |

**Primary Key:** `USERID`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

---

## 4. `TRAINER`

Stores trainer information.

| Field | Data Type | Key / Description |
|---|---|---|
| `USERID` | NUMBER | Primary Key, Foreign Key |
| `CERTIFICATIONNO` | VARCHAR2(100) | Certification number |
| `YEARSEXPERIENCE` | NUMBER | Years of experience |

**Primary Key:** `USERID`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

> A trainer does not have a separate `TRAINERID`. The trainer is identified using `USERID`.

---

## 5. `SUPERVISION`

Stores trainer supervision of user activities.

| Field | Data Type | Key / Description |
|---|---|---|
| `TRAINERID` | NUMBER | Part of Primary Key, FK to TRAINER |
| `USERID` | NUMBER | Part of Primary Key, FK to USERS |
| `ACTIVITYID` | NUMBER | Part of Primary Key, FK to ACTIVITY |
| `SESSIONNOTES` | VARCHAR2(500) | Trainer notes |
| `PERFORMANCERATING` | NUMBER(5,2) | Performance rating |

**Primary Key:**

```text
(TRAINERID, USERID, ACTIVITYID)
```

**Foreign Keys:**

```text
TRAINERID → TRAINER(USERID)
USERID → USERS(USERID)
ACTIVITYID → ACTIVITY(ACTIVITYID)
```

---

## 6. `ACTIVITY`

Stores user fitness activities.

| Field | Data Type | Key / Description |
|---|---|---|
| `ACTIVITYID` | NUMBER | Primary Key, Identity |
| `TYPE` | VARCHAR2(100) | Activity type |
| `DURATION` | NUMBER | Activity duration |
| `DISTANCE` | NUMBER | Distance |
| `"Date"` | DATE | Activity date |
| `USERID` | NUMBER | Foreign Key |

**Primary Key:** `ACTIVITYID`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

---

## 7. `ACHIEVEMENT`

Stores available achievements.

| Field | Data Type | Key / Description |
|---|---|---|
| `ACHIEVEMENTID` | NUMBER | Primary Key, Identity |
| `TITLE` | VARCHAR2(200) | Achievement title |
| `DESCRIPTION` | VARCHAR2(1000) | Achievement description |
| `DATEAWARDED` | DATE | Date awarded |

**Primary Key:** `ACHIEVEMENTID`

---

## 8. `EARNS`

Associates activities with achievements.

| Field | Data Type | Key / Description |
|---|---|---|
| `ACTIVITYID` | NUMBER | Part of Primary Key, Foreign Key |
| `ACHIEVEMENTID` | NUMBER | Part of Primary Key, Foreign Key |

**Primary Key:**

```text
(ACTIVITYID, ACHIEVEMENTID)
```

**Foreign Keys:**

```text
ACTIVITYID → ACTIVITY(ACTIVITYID)
ACHIEVEMENTID → ACHIEVEMENT(ACHIEVEMENTID)
```

This represents a **many-to-many relationship** between activities and achievements.

---

## 9. `GOAL`

Stores user fitness goals.

| Field | Data Type | Key / Description |
|---|---|---|
| `GOALID` | NUMBER | Primary Key, Identity |
| `GOALTYPE` | VARCHAR2(100) | Type of goal |
| `TARGETVALUE` | NUMBER(12,2) | Target value |
| `DEADLINE` | DATE | Goal deadline |
| `USERID` | NUMBER | Foreign Key |

**Primary Key:** `GOALID`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

---

## 10. `NUTRITION`

Stores meal and nutrition records.

| Field | Data Type | Key / Description |
|---|---|---|
| `NUTRITIONID` | NUMBER | Primary Key, Identity |
| `MEALTYPE` | VARCHAR2(100) | Meal type |
| `CALORIES` | NUMBER(10,2) | Calories |
| `QUANTITY` | NUMBER(10,2) | Quantity |
| `"Date"` | DATE | Meal date |
| `USERID` | NUMBER | Foreign Key |

**Primary Key:** `NUTRITIONID`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

---

## 11. `NUTRITION_FOODITEM`

Stores individual food items belonging to nutrition records.

| Field | Data Type | Key / Description |
|---|---|---|
| `NUTRITIONID` | NUMBER | Part of Primary Key, Foreign Key |
| `FOODITEM` | VARCHAR2(200) | Food item |

**Primary Key:**

```text
(NUTRITIONID, FOODITEM)
```

**Foreign Key:**

```text
NUTRITIONID → NUTRITION(NUTRITIONID)
```

---

## 12. `WEARABLE_DEVICE`

Stores wearable devices registered by users.

| Field | Data Type | Key / Description |
|---|---|---|
| `DEVICEID` | NUMBER | Primary Key, Identity |
| `BRAND` | VARCHAR2(100) | Device brand |
| `MODEL` | VARCHAR2(100) | Device model |
| `SERIALNUMBER` | VARCHAR2(100) | Device serial number |
| `USERID` | NUMBER | Foreign Key |

**Primary Key:** `DEVICEID`

**Foreign Key:**

```text
USERID → USERS(USERID)
```

---

## 13. `DEVICE_FEATURE`

Stores features associated with wearable devices.

| Field | Data Type | Key / Description |
|---|---|---|
| `DEVICEID` | NUMBER | Part of Primary Key, Foreign Key |
| `FEATURENAME` | VARCHAR2(200) | Device feature |

**Primary Key:**

```text
(DEVICEID, FEATURENAME)
```

**Foreign Key:**

```text
DEVICEID → WEARABLE_DEVICE(DEVICEID)
```

---

## 14. `SMARTWATCH`

Stores smartwatch-specific information.

| Field | Data Type | Key / Description |
|---|---|---|
| `DEVICEID` | NUMBER | Primary Key, Foreign Key |
| `HASGPS` | VARCHAR2(10) | GPS availability |
| `WATERRESISTANCE` | VARCHAR2(100) | Water resistance information |

**Primary Key:** `DEVICEID`

**Foreign Key:**

```text
DEVICEID → WEARABLE_DEVICE(DEVICEID)
```

---

## 15. `FITNESS_BAND`

Stores fitness-band-specific information.

| Field | Data Type | Key / Description |
|---|---|---|
| `DEVICEID` | NUMBER | Primary Key, Foreign Key |
| `BANDMATERIAL` | VARCHAR2(100) | Band material |
| `HASHRSENSOR` | VARCHAR2(10) | Heart-rate sensor availability |

**Primary Key:** `DEVICEID`

**Foreign Key:**

```text
DEVICEID → WEARABLE_DEVICE(DEVICEID)
```

---

## 16. `HEALTH_METRIC`

Stores health measurements generated by wearable devices.

| Field | Data Type | Key / Description |
|---|---|---|
| `DEVICEID` | NUMBER | Foreign Key |
| `METRICID` | NUMBER | Primary Key |
| `METRICTYPE` | VARCHAR2(100) | Type of metric |
| `VALUE` | NUMBER(12,2) | Metric value |
| `UNIT` | VARCHAR2(50) | Measurement unit |
| `"TIMESTAMP"` | TIMESTAMP(6) | Measurement timestamp |

**Primary Key:** `METRICID`

**Foreign Key:**

```text
DEVICEID → WEARABLE_DEVICE(DEVICEID)
```

### Automatic Metric ID

Unlike the other major entities, `METRICID` is not an identity column.

It is generated using:

```text
HEALTH_METRIC_SEQ
        │
        ▼
HEALTH_METRIC_BI
        │
        ▼
METRICID
```

---

## 17. `NOTIFICATION_RECIPIENT`

Stores notification recipient and preference information.

| Field | Data Type | Key / Description |
|---|---|---|
| `RECIPIENTID` | NUMBER | Primary Key, Identity |
| `SOURCETYPE` | VARCHAR2(100) | Notification source |
| `USERID` | NUMBER | Foreign Key |
| `TRAINERUSERID` | NUMBER | Foreign Key |
| `CONTACTCHANNEL` | VARCHAR2(100) | Contact method |
| `NOTIFICATIONPREF` | VARCHAR2(100) | Notification preference |

**Primary Key:** `RECIPIENTID`

**Foreign Keys:**

```text
USERID → USERS(USERID)
TRAINERUSERID → TRAINER(USERID)
```

---

## 18. `USER_FOLLOWS`

Stores user-to-user following relationships.

| Field | Data Type | Key / Description |
|---|---|---|
| `FOLLOWERID` | NUMBER | Part of Primary Key, Foreign Key |
| `FOLLOWEEID` | NUMBER | Part of Primary Key, Foreign Key |

**Primary Key:**

```text
(FOLLOWERID, FOLLOWEEID)
```

**Foreign Keys:**

```text
FOLLOWERID → USERS(USERID)
FOLLOWEEID → USERS(USERID)
```

---

# 🔗 Complete Relationship Overview

```text
                         ┌──────────────┐
                         │    USERS     │
                         └──────┬───────┘
                                │
        ┌───────────┬───────────┼───────────┬────────────┐
        │           │           │           │            │
        ▼           ▼           ▼           ▼            ▼
 USER_PHONE     ATHLETE      TRAINER    ACTIVITY       GOAL
                                │           │
                                │           │
                                ▼           ▼
                           SUPERVISION     EARNS
                                            │
                                            ▼
                                      ACHIEVEMENT


USERS
  │
  ├──────────────► NUTRITION
  │                    │
  │                    ▼
  │              NUTRITION_FOODITEM
  │
  └──────────────► WEARABLE_DEVICE
                       │
              ┌────────┼──────────┐
              │        │          │
              ▼        ▼          ▼
       DEVICE_FEATURE  SMARTWATCH FITNESS_BAND
                       │
                       │
                       ▼
                  HEALTH_METRIC


USERS
  │
  ├──────────────► NOTIFICATION_RECIPIENT
  │                       │
  │                       └──────► TRAINER
  │
  └──────────────► USER_FOLLOWS
                         │
                         └──────► USERS
```

---

# 🔑 Primary Keys

The database uses the following primary keys:

| Table | Primary Key |
|---|---|
| `USERS` | `USERID` |
| `ACHIEVEMENT` | `ACHIEVEMENTID` |
| `ACTIVITY` | `ACTIVITYID` |
| `ATHLETE` | `USERID` |
| `TRAINER` | `USERID` |
| `USER_PHONE` | `(USERID, PHONENUMBER)` |
| `WEARABLE_DEVICE` | `DEVICEID` |
| `DEVICE_FEATURE` | `(DEVICEID, FEATURENAME)` |
| `FITNESS_BAND` | `DEVICEID` |
| `SMARTWATCH` | `DEVICEID` |
| `HEALTH_METRIC` | `METRICID` |
| `GOAL` | `GOALID` |
| `NUTRITION` | `NUTRITIONID` |
| `NUTRITION_FOODITEM` | `(NUTRITIONID, FOODITEM)` |
| `NOTIFICATION_RECIPIENT` | `RECIPIENTID` |
| `SUPERVISION` | `(TRAINERID, USERID, ACTIVITYID)` |
| `EARNS` | `(ACTIVITYID, ACHIEVEMENTID)` |
| `USER_FOLLOWS` | `(FOLLOWERID, FOLLOWEEID)` |

---

# 🔗 Foreign Keys

The database enforces the following relationships:

```text
ACTIVITY.USERID
    → USERS.USERID

ATHLETE.USERID
    → USERS.USERID

TRAINER.USERID
    → USERS.USERID

USER_PHONE.USERID
    → USERS.USERID

WEARABLE_DEVICE.USERID
    → USERS.USERID

DEVICE_FEATURE.DEVICEID
    → WEARABLE_DEVICE.DEVICEID

FITNESS_BAND.DEVICEID
    → WEARABLE_DEVICE.DEVICEID

SMARTWATCH.DEVICEID
    → WEARABLE_DEVICE.DEVICEID

HEALTH_METRIC.DEVICEID
    → WEARABLE_DEVICE.DEVICEID

GOAL.USERID
    → USERS.USERID

NUTRITION.USERID
    → USERS.USERID

NUTRITION_FOODITEM.NUTRITIONID
    → NUTRITION.NUTRITIONID

NOTIFICATION_RECIPIENT.USERID
    → USERS.USERID

NOTIFICATION_RECIPIENT.TRAINERUSERID
    → TRAINER.USERID

SUPERVISION.TRAINERID
    → TRAINER.USERID

SUPERVISION.USERID
    → USERS.USERID

SUPERVISION.ACTIVITYID
    → ACTIVITY.ACTIVITYID

EARNS.ACTIVITYID
    → ACTIVITY.ACTIVITYID

EARNS.ACHIEVEMENTID
    → ACHIEVEMENT.ACHIEVEMENTID

USER_FOLLOWS.FOLLOWERID
    → USERS.USERID

USER_FOLLOWS.FOLLOWEEID
    → USERS.USERID
```

---

# ⚙️ Identity Columns

Oracle identity columns automatically generate IDs for:

```text
USERS.USERID
ACTIVITY.ACTIVITYID
ACHIEVEMENT.ACHIEVEMENTID
GOAL.GOALID
NUTRITION.NUTRITIONID
NOTIFICATION_RECIPIENT.RECIPIENTID
WEARABLE_DEVICE.DEVICEID
```

`HEALTH_METRIC.METRICID` uses a separate sequence and trigger.

---

# 🔢 Sequence

The database contains:

```text
HEALTH_METRIC_SEQ
```

Definition:

```sql
CREATE SEQUENCE HEALTH_METRIC_SEQ
START WITH 1
INCREMENT BY 1;
```

---

# ⚡ Trigger

The database contains:

```text
HEALTH_METRIC_BI
```

The trigger automatically assigns the next sequence value when `METRICID` is not supplied.

```sql
CREATE OR REPLACE TRIGGER HEALTH_METRIC_BI
BEFORE INSERT ON HEALTH_METRIC
FOR EACH ROW
WHEN (NEW.METRICID IS NULL)
BEGIN
    SELECT HEALTH_METRIC_SEQ.NEXTVAL
    INTO :NEW.METRICID
    FROM DUAL;
END;
```

---

# 📊 DBMS Concepts Demonstrated

FitTrack demonstrates practical implementation of:

- Relational database design
- Entity relationships
- Primary keys
- Foreign keys
- Composite primary keys
- One-to-one relationships
- One-to-many relationships
- Many-to-many relationships
- Normalization
- Referential integrity
- Identity columns
- Sequences
- Triggers
- SQL joins
- Aggregation
- CRUD operations
- Transactions
- Constraints
- Connection pooling
- REST API integration

---

# 📁 Project Structure

```text
FITNESS-TRACKER-DBMS-PROJECT/
│
├── backend/
│   ├── config/
│   │   └── database.js
│   │
│   ├── database/
│   │   ├── 01_schema.sql
│   │   ├── 02_sequences.sql
│   │   └── 03_triggers.sql
│   │
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── routes/
│   │   └── api.js
│   │
│   ├── scripts/
│   │   └── setupDatabase.js
│   │
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── utils/
│   │   └── App.jsx
│   │
│   ├── package.json
│   └── vite.config.js
│
├── README.md
└── .gitignore
```

---

# 🚀 Complete Installation Guide

This section explains how a new user can clone and run FitTrack on another computer.

## Step 1 — Install Git

Install Git on the computer.

Verify:

```bash
git --version
```

---

## Step 2 — Install Node.js

Install a current **LTS version of Node.js**.

Verify:

```bash
node --version
npm --version
```

---

## Step 3 — Install Oracle Database

Install:

**Oracle Database 23c Free**

During Oracle setup, make sure the database service and the `FREEPDB1` pluggable database are available.

The application uses:

```text
localhost:1521/FREEPDB1
```

Verify that Oracle is running before continuing.

---

# 👤 Step 4 — Create the Oracle Application User

Connect to Oracle using an administrator account.

Create a user for FitTrack:

```sql
CREATE USER GARMIN_USER IDENTIFIED BY your_password;

GRANT CREATE SESSION,
      CREATE TABLE,
      CREATE VIEW,
      CREATE SEQUENCE,
      CREATE PROCEDURE,
      CREATE TRIGGER
TO GARMIN_USER;

ALTER USER GARMIN_USER QUOTA UNLIMITED ON USERS;
```

> Replace `your_password` with a password of your choice.

Then connect using the new user:

```text
GARMIN_USER@localhost:1521/FREEPDB1
```

---

# 📥 Step 5 — Clone the Repository

Open PowerShell or Terminal.

Run:

```bash
git clone https://github.com/yashwanthT200/FITNESS-TRACKER-DBMS-PROJECT.git
```

Enter the project:

```bash
cd FITNESS-TRACKER-DBMS-PROJECT
```

---

# 📦 Step 6 — Install Backend Dependencies

```bash
cd backend
npm install
```

This installs the packages required by the backend.

---

# 🔐 Step 7 — Create the Backend `.env`

Inside:

```text
backend/
```

create:

```text
.env
```

Add:

```env
PORT=5000

ORACLE_USER=GARMIN_USER
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1

JWT_SECRET=change_this_to_a_random_secret
```

Use the same Oracle password that was chosen while creating the database user.

**Never commit `.env` to GitHub.**

---

# 🗄️ Step 8 — Automatically Create the Database

From:

```text
FITNESS-TRACKER-DBMS-PROJECT/backend
```

run:

```bash
npm run db:setup
```

The setup script executes:

```text
01_schema.sql
        ↓
18 tables

02_sequences.sql
        ↓
HEALTH_METRIC_SEQ

03_triggers.sql
        ↓
HEALTH_METRIC_BI
```

A successful setup will display:

```text
Connected to Oracle.
...
Database setup completed successfully.
18-table FitTrack schema is ready.
Sequences are ready.
Triggers are ready.
```

No manual table creation is required.

---

# 🚀 Step 9 — Start the Backend

From:

```text
backend
```

run:

```bash
npm start
```

The backend will run on:

```text
http://localhost:5000
```

You can test it by opening:

```text
http://localhost:5000
```

Expected response:

```text
Garmin Clone API is running
```

> The API implementation may use existing internal naming inherited from earlier development, but the application itself is presented as FitTrack.

---

# 💻 Step 10 — Install Frontend Dependencies

Open a **new terminal**.

From the project root:

```bash
cd FITNESS-TRACKER-DBMS-PROJECT/frontend
```

Run:

```bash
npm install
```

---

# ▶️ Step 11 — Start the Frontend

Run:

```bash
npm run dev
```

Vite will display the local frontend URL, normally:

```text
http://localhost:5173
```

Open that URL in your browser.

---

# 🎉 Complete Startup Procedure

After the initial installation, the normal workflow is:

### Terminal 1 — Backend

```bash
cd FITNESS-TRACKER-DBMS-PROJECT/backend
npm start
```

### Terminal 2 — Frontend

```bash
cd FITNESS-TRACKER-DBMS-PROJECT/frontend
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# 🔄 First-Time Setup Summary

For a completely new computer:

```text
Install Git
    ↓
Install Node.js
    ↓
Install Oracle Database 23c Free
    ↓
Create Oracle user
    ↓
Clone GitHub repository
    ↓
cd backend
    ↓
npm install
    ↓
Create .env
    ↓
npm run db:setup
    ↓
npm start
    ↓
Open second terminal
    ↓
cd frontend
    ↓
npm install
    ↓
npm run dev
    ↓
Open http://localhost:5173
```

---

# 🔍 Verify the Database

After running the setup, connect to the Oracle application user and run:

```sql
SELECT TABLE_NAME
FROM USER_TABLES
ORDER BY TABLE_NAME;
```

You should see the 18 FitTrack tables.

### Check columns

```sql
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE
FROM USER_TAB_COLUMNS
ORDER BY TABLE_NAME, COLUMN_ID;
```

### Check sequence

```sql
SELECT SEQUENCE_NAME
FROM USER_SEQUENCES;
```

Expected:

```text
HEALTH_METRIC_SEQ
```

### Check trigger

```sql
SELECT
    TRIGGER_NAME,
    STATUS
FROM USER_TRIGGERS;
```

Expected:

```text
HEALTH_METRIC_BI    ENABLED
```

---

# 🧪 Test Automatic Health Metric ID

The `METRICID` can be automatically generated.

For example:

```sql
INSERT INTO HEALTH_METRIC
    (DEVICEID, METRICTYPE, VALUE, UNIT, "TIMESTAMP")
VALUES
    (1, 'Heart Rate', 72, 'BPM', SYSTIMESTAMP);

COMMIT;
```

No `METRICID` is supplied.

The trigger automatically obtains the next value from:

```text
HEALTH_METRIC_SEQ
```

---

# 🔐 Authentication Flow

```text
User
 │
 ▼
Login
 │
 ▼
POST /api/login
 │
 ▼
Oracle USERS
 │
 ▼
bcrypt password verification
 │
 ▼
JWT generated
 │
 ▼
Frontend stores authentication state
 │
 ▼
Authenticated API requests
 │
 ▼
JWT middleware
 │
 ▼
req.user.UserID
```

User-specific database operations use the authenticated `UserID`.

---

# 🔒 User Data Isolation

Personal records are associated with the authenticated user.

For example:

```text
JWT
 │
 ▼
UserID
 │
 ▼
SQL query
 │
 ▼
WHERE USERID = :userId
 │
 ▼
User's own records
```

This is applied to user-owned resources such as:

- Activities
- Goals
- Nutrition
- Devices
- Profile information
- Social relationships
- Notifications

---

# 📡 API Modules

The backend provides API functionality for:

```text
Authentication
Profile
Activities
Nutrition
Goals
Achievements
Devices
Health Metrics
Trainers
Notifications
Social
SQL Terminal
```

The implementation is located primarily in:

```text
backend/routes/api.js
```

---

# 🖥️ SQL Terminal

FitTrack includes an SQL terminal for database exploration.

Example:

```sql
SELECT *
FROM USERS;
```

Example relational query:

```sql
SELECT
    u.FIRSTNAME,
    u.LASTNAME,
    a.TYPE,
    a.DURATION,
    a.DISTANCE
FROM USERS u
JOIN ACTIVITY a
    ON u.USERID = a.USERID;
```

This allows DBMS concepts to be demonstrated directly through the application.

---

# 🐳 Docker Distribution

Docker support is planned as a distribution option.

The intended deployment will allow:

```text
Git Clone
    ↓
Docker Compose
    ↓
Oracle Database
    ↓
Automatic Schema Setup
    ↓
Backend
    ↓
Frontend
```

The current local development setup uses a directly installed Oracle Database.

---

# 🐛 Troubleshooting

## Oracle connection failed

Check:

```env
ORACLE_USER=GARMIN_USER
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1
```

Also verify that Oracle is running.

---

## `npm` is not recognized

Install Node.js and restart the terminal.

Verify:

```bash
node --version
npm --version
```

---

## `git` is not recognized

Install Git and restart the terminal.

Verify:

```bash
git --version
```

---

## Port 5000 already in use

Change:

```env
PORT=5000
```

to another available port.

---

## Database tables already exist

Run:

```bash
npm run db:setup
```

The installer detects existing objects and skips the table creation statements.

---

## Frontend cannot connect to backend

Make sure the backend is running:

```bash
npm start
```

Then verify:

```text
http://localhost:5000
```

---

# 📚 Academic DBMS Coverage

FitTrack can be used to demonstrate the following DBMS topics:

### Database Design

- ER-style entity modeling
- Relational schema design
- Normalization
- Entity relationships

### Keys

- Primary keys
- Foreign keys
- Composite primary keys

### Oracle Features

- Identity columns
- Sequences
- Triggers
- Constraints
- Views
- Transactions

### SQL

- SELECT
- INSERT
- UPDATE
- DELETE
- JOIN
- GROUP BY
- Aggregation
- Filtering
- Subqueries

### Application Integration

- REST APIs
- Connection pooling
- Authentication
- Database CRUD
- Transaction management

---

# 📈 Application Data Flow

```text
User Action
     │
     ▼
React Frontend
     │
     ▼
REST API
     │
     ▼
JWT Authentication
     │
     ▼
Express Route
     │
     ▼
Oracle Connection Pool
     │
     ▼
SQL Query
     │
     ▼
Oracle Database
     │
     ▼
JSON Response
     │
     ▼
React UI
```

---

# 🗂️ Database Initialization Files

The database initialization system is separated into three files:

```text
backend/database/
│
├── 01_schema.sql
├── 02_sequences.sql
└── 03_triggers.sql
```

### `01_schema.sql`

Creates the 18 relational tables.

### `02_sequences.sql`

Creates:

```text
HEALTH_METRIC_SEQ
```

### `03_triggers.sql`

Creates:

```text
HEALTH_METRIC_BI
```

### `setupDatabase.js`

Executes the database initialization files automatically:

```text
setupDatabase.js
      │
      ├── 01_schema.sql
      │
      ├── 02_sequences.sql
      │
      └── 03_triggers.sql
```

---

# 🔄 Re-running Database Setup

The setup command is safe to run again during development:

```bash
npm run db:setup
```

Existing tables are detected and skipped.

The trigger is recreated using:

```sql
CREATE OR REPLACE TRIGGER
```

This allows trigger changes to be applied without manually deleting the trigger.

---

# 🔒 Security Notes

Do not commit sensitive configuration.

The following should remain local:

```text
.env
database passwords
JWT secrets
private credentials
```

The repository should contain an `.env.example` rather than a real `.env`.

Example:

```env
PORT=5000
ORACLE_USER=your_oracle_user
ORACLE_PASSWORD=your_oracle_password
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1
JWT_SECRET=your_jwt_secret
```

---

# 📋 Quick Command Reference

## Clone

```bash
git clone https://github.com/yashwanthT200/FITNESS-TRACKER-DBMS-PROJECT.git
```

## Backend

```bash
cd FITNESS-TRACKER-DBMS-PROJECT/backend
npm install
npm run db:setup
npm start
```

## Frontend

```bash
cd FITNESS-TRACKER-DBMS-PROJECT/frontend
npm install
npm run dev
```

## Backend URL

```text
http://localhost:5000
```

## Frontend URL

```text
http://localhost:5173
```

---

# 📌 Database Summary

| Category | Count / Technology |
|---|---|
| Relational Tables | 18 |
| Database | Oracle Database 23c Free |
| Identity Columns | 7 |
| Custom Sequences | 1 |
| Custom Triggers | 1 |
| Composite Primary Keys | 6 |
| Foreign-Key Relationships | 20 |
| Backend | Node.js + Express |
| Frontend | React + Vite |
| Authentication | JWT |
| Password Hashing | bcrypt |
| Database Driver | node-oracledb |
