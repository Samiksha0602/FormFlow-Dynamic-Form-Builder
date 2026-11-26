# FormFlow – Dynamic Form Builder & Public Registration Portal

FormFlow is a dynamic form-building platform that allows administrators to create, customize, publish, and manage forms through an intuitive interface. Each published form gets a unique public URL, allowing users to submit responses without requiring an admin login.

The platform also provides centralized submission management and downloadable PDF reports for submitted responses.

## Features

### Admin Dashboard
- Secure admin login.
- Create, edit, and delete forms.
- Search and filter forms.
- View form status and manage published forms.

### Dynamic Form Builder
- Add and configure different field types.
- Customize field labels, placeholders, default values, and help text.
- Configure required fields and validation rules.
- Preview forms before publishing.
- Publish or deactivate forms.

### Public Registration Portal
- Generate unique, shareable URLs for published forms.
- Render forms dynamically using saved form configurations.
- Validate user inputs before submission.
- Display submission confirmation after successful submission.

### Submission Management
- View submissions for individual forms.
- Access submitted response details.
- Store submission data in the database.
- Download individual submissions as PDF reports.

### PDF Generation
- Generate downloadable PDF reports using ReportLab.
- Retrieve submission details from the database.
- Generate PDFs dynamically without permanently storing generated files on the server.

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, JavaScript, Vite |
| Backend | Python, FastAPI |
| Database | MySQL |
| ORM | SQLAlchemy |
| API Communication | Axios, REST APIs |
| PDF Generation | ReportLab |
| Routing | React Router |

## Project Structure

```text
FormFlow/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── ...
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

*The structure above is a simplified overview; individual backend and frontend files may vary.*

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Python 3.10+
- Node.js and npm
- MySQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/Samiksha0602/FormFlow-Dynamic-Form-Builder.git

cd FormFlow-Dynamic-Form-Builder
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python -m venv venv
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Configure your environment variables using the project's `.env.example` file. Set the required database connection details and admin credentials.

Create the MySQL database and ensure the configured database user has the required permissions.

Start the backend server:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend API:

`http://127.0.0.1:8000`

API documentation:

`http://127.0.0.1:8000/docs`

### 3. Frontend Setup

Open a separate terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed by Vite, typically:

`http://localhost:5173`

## Application Workflow

1. **Admin Login:** The administrator logs in to access the dashboard.
2. **Create Form:** A new form is created using the dynamic form builder.
3. **Configure Fields:** Fields, validation rules, labels, and other properties are customized.
4. **Preview:** The form is previewed before publication.
5. **Publish:** The application generates a unique public URL for the form.
6. **Collect Responses:** Users access the public URL and submit their responses.
7. **Manage Submissions:** Administrators view and manage submitted responses.
8. **Download PDF:** Submission details can be downloaded as PDF reports.

## Database Overview

The application uses MySQL to store form configurations and submission records.

**Forms**
- Form ID
- Form name and description
- Unique form slug
- Form configuration (JSON)
- Publication status
- Created and updated timestamps

**Form Submissions**
- Submission ID
- Associated form ID
- Submission data (JSON)
- Submission timestamp
- Submission status
- Form configuration snapshot

## PDF Generation Process

PDF reports are generated dynamically using ReportLab.

1. The frontend requests a PDF for a selected submission.
2. The FastAPI backend retrieves the submission from MySQL.
3. ReportLab generates the PDF in memory using `BytesIO`.
4. FastAPI returns the generated document as a downloadable response.
5. The frontend processes the response as a Blob and triggers the browser download.

## API Documentation

FastAPI provides interactive API documentation through Swagger UI:

`http://127.0.0.1:8000/docs`

This can be used to explore and test the available REST API endpoints.

## Future Enhancements

- Support for file-upload fields.
- Multiple administrator accounts and role-based access.
- Advanced form analytics and response visualizations.
- Email notifications after form submission.
- Form templates for faster creation.
- Enhanced export options for submissions.

## Author

**Samiksha Sawant**

B.Tech – Computer Science and Engineering  
Sardar Patel Institute of Technology, Mumbai

---

*FormFlow – Create, Publish, Collect, and Manage Forms Easily.*
