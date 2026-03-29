# P08-AgriqQual-prototype

Before running this project, make sure you have the following installed:
- Node.js (v14 or higher)
- npm (v6 or higher)
- MongoDB (local installation or MongoDB Atlas account)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/blndeyes/P08-AgriqQual-prototype.git
cd P08-AgriqQual-prototype
```

2. Install dependencies for both frontend and backend:
```bash
npm install
cd frontend && npm install
cd ../backend && npm install

To run both frontend and backend concurrently:

```bash
npm run dev
```

This will start:
- Frontend on `http://localhost:3000`
- Backend on `http://localhost:5000`

### Run Separately

**Backend only:**
```bash
cd backend
npm run dev