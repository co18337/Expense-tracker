"""
AI Service - Hardened against Hallucinations
"""
import os
import json
from datetime import datetime, date, timedelta
from groq import Groq
from app.models import db, Expense

client = Groq(api_key=os.getenv("GROK_API_KEY"))

class ExpenseExtractor:
    def __init__(self):
        self.model = "llama-3.1-8b-instant"

    def process_message(self, user_message, known_categories=None):
        """
        Classify intent and extract data.
        """
        if not known_categories:
            known_categories = ["Food", "Transport", "Utilities", "Entertainment", "Health", "Shopping"]

        cat_str = ", ".join(known_categories)
        today_str = date.today().isoformat()

        # ✅ CHANGED: Added STRICT RULES to prevent hallucinating "500"
        system_prompt = f"""You are ExpenseAI. Classify intent and extract data.
TODAY: {today_str}
CATEGORIES: {cat_str}

INTENTS:
- ADD_EXPENSE: User wants to track spending (e.g. "spent 500 on food", "cab 200").
- QUERY: User asks about spending history (e.g. "how much this month?", "total spent?").
- HELP: User asks for help or says "hi", "hello".
- UNKNOWN: Input is vague, gibberish, or unrelated (e.g. "new way", "ok", "cool").

⚠️ STRICT RULES:
1. IF NO NUMBER is in the user input, 'amount' MUST be null. DO NOT GUESS.
2. DO NOT hallucinate numbers. If the user didn't say "500", do not output "500".
3. If the input is ambiguous (like "new way"), classify as "UNKNOWN" or "HELP".

Return ONLY raw JSON:
{{
  "intent": "ADD_EXPENSE|QUERY|HELP|UNKNOWN",
  "data": {{
    "amount": null_or_number,
    "category": null_or_string,
    "description": null_or_string,
    "date": null_or_YYYY-MM-DD
  }},
  "is_complete": boolean,
  "missing_fields": [],
  "query_scope": "THIS_MONTH|LAST_MONTH|TODAY|TOTAL",
  "query_category": null_or_string,
  "response": "Short message"
}}"""

        try:
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.0, # ✅ LOWERED TEMP: Makes AI stricter/less creative
            )

            content = response.choices[0].message.content.strip()
            
            if content.startswith("```"):
                content = content.replace("```json", "").replace("```", "").strip()

            result = json.loads(content)
            
            if result.get("intent") == "ADD_EXPENSE" and not result.get("data", {}).get("date"):
                result["data"]["date"] = today_str

            return result

        except Exception as e:
            print(f"AI Service Error: {e}")
            return {
                "intent": "UNKNOWN",
                "response": "I didn't catch that. Try 'Spent 100 on Cab'."
            }

    # ... (Keep get_expenses_by_scope, detect_recurring, suggest_expense_summary exactly as they were) ...
    def get_expenses_by_scope(self, scope):
        today = date.today()
        all_expenses = Expense.query.all()
        
        if scope == "TODAY":
            return [e for e in all_expenses if e.date == today]
        elif scope == "THIS_MONTH":
            return [e for e in all_expenses if e.date.year == today.year and e.date.month == today.month]
        elif scope == "LAST_MONTH":
            first_of_this_month = today.replace(day=1)
            last_month_end = first_of_this_month - timedelta(days=1)
            return [e for e in all_expenses if e.date.year == last_month_end.year and e.date.month == last_month_end.month]
        elif scope == "TOTAL":
            return all_expenses
        else:
            return []

    def format_scope_label(self, scope):
        labels = {"TODAY": "Today", "THIS_MONTH": "This Month", "LAST_MONTH": "Last Month", "TOTAL": "All Time"}
        return labels.get(scope, scope)

    def detect_recurring(self, user_id=None):
        expenses = Expense.query.all()
        if len(expenses) < 3: return []

        recurring_patterns = {}
        for exp in expenses:
            recurring_patterns.setdefault(exp.category, []).append(exp)

        results = []
        for category, exps in recurring_patterns.items():
            if len(exps) < 2: continue
            amounts = [e.amount for e in exps]
            avg_amount = sum(amounts) / len(amounts)
            similar = [e for e in exps if abs(e.amount - avg_amount) < avg_amount * 0.1]
            if len(similar) >= 2:
                from collections import Counter
                weekdays = [e.date.weekday() for e in similar]
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
        today = date.today()
        today_exps = Expense.query.filter(Expense.date == today).all()
        if not today_exps: return "No expenses today yet 💰"
        
        total = sum(e.amount for e in today_exps)
        count = len(today_exps)
        categories = {}
        for exp in today_exps: categories.setdefault(exp.category, []).append(exp)
        
        summary = f"📊 Today:\nTotal: ₹{total:.2f} ({count} expenses)\n\n"
        for cat, exps in categories.items():
            cat_total = sum(e.amount for e in exps)
            summary += f"• {cat}: ₹{cat_total:.2f}\n"
        return summary

def create_expense_extractor():
    return ExpenseExtractor()