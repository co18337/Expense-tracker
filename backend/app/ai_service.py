"""
AI Service - Handle natural language processing with Groq API
Extracts expenses from user messages and suggests recurring patterns
"""

import os
import json
from datetime import datetime, date
from groq import Groq
from app.models import db, Expense

# Configure Groq client
client = Groq(api_key=os.getenv("GROK_API_KEY"))


class ExpenseExtractor:
    """
    What: Extracts expense details from natural language using Groq
    Why: Users can say "I spent 500 on lunch today" instead of manual entry
    """

    def __init__(self):
        """
        Initialize Groq model
        Using LLaMA 3 – fast, free-tier friendly
        """
        self.model = "llama-3.1-8b-instant"
        self.conversation_history = []

    def extract_expense(self, user_message):
        """
        What: Parses user message to extract expense details
        Why: Convert "I spent 500 on pizza yesterday" to structured data

        Returns: Dict with extracted expense data
        """

        system_prompt = """
You are an expense tracker AI.
Extract expense details from user messages.

Return ONLY valid JSON (no markdown, no explanation):

{
  "amount": number or null,
  "category": "Food|Transport|Utilities|Entertainment|Health|Shopping|Education|Other"|null,
  "description": string or null,
  "date": null,
  "is_valid": boolean,
  "confidence": number (0-100),
  "missing_fields": [],
  "clarification": string
}

Rules:
- DO NOT infer or guess dates
- Leave date as null
- If category unclear, set null
- Confidence reflects certainty
"""

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.2,
            )

            response_text = response.choices[0].message.content.strip()
            extracted_data = json.loads(response_text)

            # ✅ AUTHORITATIVE DATE SOURCE: SERVER DATE ONLY
            extracted_data["date"] = date.today().isoformat()

            return extracted_data

        except Exception as e:
            return {
                "is_valid": False,
                "error": str(e),
                "clarification": "Sorry, I had trouble understanding that. Can you try again?",
            }

    def ask_clarification(self, extracted_data):
        """
        Generates clarifying questions for missing data
        """

        missing = extracted_data.get("missing_fields", [])
        confidence = extracted_data.get("confidence", 0)

        if confidence < 50 or missing:
            return extracted_data.get(
                "clarification",
                "Could you provide more details about this expense?",
            )

        return None

    def detect_recurring(self, user_id=None):
        """
        Detect recurring expenses based on past data
        """

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
                    day_name = [
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                        "Sunday",
                    ][common_day]

                    results.append(
                        {
                            "category": category,
                            "frequency": "weekly",
                            "day": day_name,
                            "average_amount": round(avg_amount, 2),
                            "confidence": round((len(similar) / len(exps)) * 100, 2),
                        }
                    )

        return results

    def suggest_expense_summary(self):
        """
        Creates a friendly summary of today's expenses
        """

        today = date.today()
        today_exps = Expense.query.filter(Expense.date == today).all()

        if not today_exps:
            return "No expenses recorded today yet. Stay frugal! 💰"

        total = sum(e.amount for e in today_exps)
        count = len(today_exps)

        categories = {}
        for exp in today_exps:
            categories.setdefault(exp.category, []).append(exp)

        summary = f"📊 Today's Summary:\n"
        summary += f"Total: ₹{total:.2f} ({count} expense{'s' if count > 1 else ''})\n\n"

        for cat, exps in categories.items():
            cat_total = sum(e.amount for e in exps)
            summary += f"• {cat}: ₹{cat_total:.2f}\n"

        return summary


def create_expense_extractor():
    """Factory function"""
    return ExpenseExtractor()
