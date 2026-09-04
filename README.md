# AI CODE REVIEW

Build an AI Code Review System in Python

I want to build a complete AI Code Review System using Python. This should be a beginner-to-intermediate level portfolio project that looks professional and demonstrates Python, AI, APIs, code analysis, and software development skills.

1. Project Goal

Build a web-based application where a user can:

Paste Python code into an editor.

Upload a Python .py file.

Click Review Code.

The system analyzes the code automatically.

Display:

Bugs/errors

Code quality issues

Security concerns

Performance suggestions

PEP 8/style issues

Possible improvements

Overall code quality score

Provide an improved version of the code when possible.

2. Technology Stack

Use:

Python 3

Flask for the web application

HTML5

CSS3

JavaScript

SQLite for storing review history

Python libraries:

ast – analyze Python syntax and structure

pylint – code quality analysis

flake8 – style checking

bandit – security analysis

radon – code complexity analysis

black – code formatting

requests – API requests

sqlite3 – database

python-dotenv – environment variables

For AI-powered analysis, create an AI reviewer module that can connect to an LLM API through an API key stored in .env.

Keep the AI integration modular so the application can work with different AI APIs later.

3. Main Features

Code Input

Create a code editor where users can paste Python code.

Also provide:

Upload Python File

The application should read .py files safely and display their contents in the editor.

Static Code Analysis

Run multiple analysis tools:

Pylint

Detect programming errors

Detect bad practices

Detect unused variables/imports

Provide code-quality warnings

Flake8

Detect PEP 8 violations

Detect syntax/style problems

Bandit

Detect common Python security issues

Radon

Calculate cyclomatic complexity

Calculate maintainability information

AST
Use Python's built-in ast module to perform custom checks.

For example:

Missing functions

Excessively nested conditions

Dangerous patterns

Long functions

Duplicate-like structures where practical

4. AI Code Review

After static analysis, send the code and analysis results to the configured AI model.

Ask the AI to return structured JSON containing:

{
  "summary": "Short review summary",
  "score": 85,
  "bugs": [],
  "security_issues": [],
  "performance": [],
  "style": [],
  "best_practices": [],
  "suggestions": [],
  "improved_code": "..."
}


The AI should NOT blindly rewrite working code.

It should explain important changes and preserve the original functionality whenever possible.

5. Dashboard

Create a professional dashboard showing:

Overall Score: /100

Number of bugs

Number of security issues

Number of style issues

Complexity level

Maintainability information

Use cards, badges, progress bars, and a clean developer-style interface.

Example:

-----------------------------------------
       AI CODE REVIEW SYSTEM
-----------------------------------------

Code Quality       85/100

🐛 Bugs             2
🔒 Security         1
🎨 Style            5
⚡ Performance      2

Complexity: Medium
Maintainability: Good
-----------------------------------------


6. Review Results

Show results in separate sections:

🐛 Bugs

Show:

Line number

Problem

Explanation

Suggested fix

🔒 Security

Show:

Line number

Security problem

Risk level

Recommended solution

⚡ Performance

Show:

Problem

Why it matters

Suggested improvement

🎨 Code Style

Show:

PEP 8 issues

Formatting problems

Naming problems

💡 AI Suggestions

Show useful recommendations for making the code:

Cleaner

More readable

Maintainable

Efficient

7. Code Comparison

Create a section:

Original Code | Improved Code

Use syntax highlighting.

Allow the user to easily compare the original and AI-improved code.

Add a Copy Code button.

8. Review History

Store previous reviews in SQLite.

Database fields:

id

filename

code

score

review_summary

created_at

Create a History page where users can see previous reviews.

Allow users to open an old review.

9. Project Structure

Create a clean structure like:

ai-code-reviewer/
│
├── app.py
├── requirements.txt
├── .env
├── .gitignore
│
├── analyzer/
│   ├── __init__.py
│   ├── ast_analyzer.py
│   ├── pylint_analyzer.py
│   ├── flake8_analyzer.py
│   ├── security_analyzer.py
│   ├── complexity_analyzer.py
│   └── ai_reviewer.py
│
├── database/
│   └── database.py
│
├── utils/
│   ├── file_handler.py
│   └── parser.py
│
├── templates/
│   ├── index.html
│   ├── result.html
│   └── history.html
│
├── static/
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── script.js
│
└── uploads/


10. Important Requirements

Write clean and modular Python code.

Use functions and classes where appropriate.

Add comments explaining important logic.

Use error handling.

Validate uploaded files.

Do not expose API keys.

Store secrets only in .env.

Do not execute uploaded Python code directly.

Add a maximum file size.

Handle invalid Python files gracefully.

Show user-friendly error messages.

Keep the UI responsive.

Use syntax highlighting for code.

Do not use unnecessary frameworks.

11. API Design

Create Flask routes:

GET  /
POST /review
POST /upload
GET  /history
GET  /history/<id>


Keep the backend organized so the analysis modules can be replaced independently.

12. requirements.txt

Generate a complete requirements.txt containing every external Python dependency required by the project.

13. README.md

Create a professional GitHub README containing:

Project title

Project description

Features

Tech stack

Architecture

Installation steps

Environment setup

How to run

Screenshots section

Example usage

Future improvements

Author section

14. Development Approach

Do NOT generate the entire project blindly in one step.

Build it in stages:

Stage 1

Create the Flask application and basic UI.

Stage 2

Implement Python AST analysis.

Stage 3

Integrate Pylint and Flake8.

Stage 4

Integrate Bandit.

Stage 5

Integrate Radon.

Stage 6

Add AI-powered review.

Stage 7

Create the scoring system.

Stage 8

Add SQLite review history.

Stage 9

Improve UI/UX and syntax highlighting.

Stage 10

Create README and prepare the project for GitHub.

After completing each stage, explain:

What was created

Why it is needed

How it works

How to test it

Make the project understandable for a Python student and avoid unnecessarily advanced code.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e0ef6abb-c695-4ca3-ba8f-6a65220fca24).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
