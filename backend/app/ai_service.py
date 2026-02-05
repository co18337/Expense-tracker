"""
Phase 1: Intent Detection & Entity Extraction Service
Classifies user intent (ADD_EXPENSE, QUERY, HELP, UNKNOWN)
Extracts data in one API call
"""

import os
import json
from datetime import datetime, date
from groq import Groq
from app.models import db, Expense

client = Groq(api_key=os.getenv("GROK_API_KEY"))


class ExpenseExtractor:
    def __init__(self):
        self.model = "llama-3.1-8b-instant"

    def process_message(self, user_message, known_categories=None):
        """
        Phase 1 Core: Intent Detection + Entity Extraction
        Returns: intent, extracted data, confidence, missing fields
        """
        if not known_categories:
            known_categories = ["Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping"]
        
        cat_str = ", ".join(known_categories)
        today_str = date.today().isoformat()

        system_prompt = f"""You are ExpenseAI. Analyze the user's intent and extract data.

TODAY: {today_str}
CATEGORIES: {cat_str}

STEP 1: Determine Intent
- ADD_EXPENSE: User reports spending ("spent 500 on food", "i bought groceries for 200")
- QUERY: User asks about past spending ("total spent?", "food expenses?", "how much this month?")
- HELP: User asks for help or greets ("hi", "how do i use this?", "help")
- UNKNOWN: Gibberish or unrelated

STEP 2: If ADD_EXPENSE, extract:
- amount (number, must be > 0)
- category (match from list if possible, else suggest new)
- description (what was bought)
- date (YYYY-MM-DD, default to today if not mentioned)

STEP 3: Return JSON only, no markdown:
{{
  "intent": "ADD_EXPENSE|QUERY|HELP|UNKNOWN",
  "confidence": 0-100,
  "data": {{
    "amount": number_or_null,
    "category": "string_or_null",
    "description": "string_or_null",
    "date": "YYYY-MM-DD_or_null"
  }},
  "is_complete": true_if_all_expense_fields_present,
  "missing_fields": ["list of missing fields"],
  "query_topic": "total|category|month|etc_or_null",
  "response": "Short helpful message"
}}

Rules:
- If amount is missing, it's NOT complete
- If category is missing, it's NOT complete
- Never guess dates (use today if not mentioned)
- Always provide a response"""

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.1,
            )

            result = json.loads(response.choices[0].message.content.strip())
            
            # Ensure date is today if null
            if result.get("intent") == "ADD_EXPENSE" and not result["data"].get("date"):
                result["data"]["date"] = today_str

            return result

        except json.JSONDecodeError:
            return {
                "intent": "UNKNOWN",
                "confidence": 0,
                "response": "Sorry, couldn't understand that. Try: 'I spent 500 on food today'"
            }
        except Exception as e:
            return {
                "intent": "UNKNOWN",
                "confidence": 0,
                "response": f"Error: {str(e)}"
            }

    def detect_recurring(self, user_id=None):
        """Detect recurring expense patterns"""
        expenses = Expense.query.all()

        if len(expenses) < 3:
            return []

        recurring_patterns = {}
        for exp in expenses:
            recurring_patterns.setdefault(exp.category, []).append(exp)

        results = []
        for category, exps in recurring_patterns.items():
            if len(exps) < 2:
                continue

            amounts = [e.amount for e in exps]
            avg_amount = sum(amounts) / len(amounts)

            similar = [
                e for e in exps if abs(e.amount - avg_amount) < avg_amount * 0.1
            ]

            if len(similar) >= 2:
                from collections import Counter

                weekdays = [
                    datetime.strptime(e.date, "%Y-%m-%d").weekday()
                    for e in similar
                ]

                common_day, count = Counter(weekdays).most_common(1)[0]

                if count >= 2:
                    day_name = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][common_day]

                    results.append({
                        "category": category,
                        "frequency": "weekly",
                        "day": day_name,
                        "average_amount": round(avg_amount, 2),
                        "confidence": round((len(similar) / len(exps)) * 100, 2),
                    })

        return results

    def suggest_expense_summary(self):
        """Today's expense summary"""
        today = date.today()
        today_exps = Expense.query.filter(Expense.date == today).all()

        if not today_exps:
            return "No expenses today yet. Stay frugal! 💰"

        total = sum(e.amount for e in today_exps)
        count = len(today_exps)

        categories = {}
        for exp in today_exps:
            categories.setdefault(exp.category, []).append(exp)

        summary = f"📊 Today ({today}):\n"
        summary += f"Total: ₹{total:.2f} ({count} expense{'s' if count > 1 else ''})\n\n"

        for cat, exps in categories.items():
            cat_total = sum(e.amount for e in exps)
            summary += f"• {cat}: ₹{cat_total:.2f}\n"

        return summary


def create_expense_extractor():
    return ExpenseExtractor()