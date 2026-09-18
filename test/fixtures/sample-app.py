import anthropic

client = anthropic.Anthropic()

# Hardcoded key — should trigger security warning
api_key = "sk-ant-test1234567890abcdefgh"

# Uses llama — should trigger license warning
model = "meta-llama/Llama-3.1-70B-Instruct"

# Has PII — should trigger privacy warning
user_email = "realuser@company.com"
user_ssn = "123-45-6789"

# No max_tokens, expensive model — should trigger cost warning
for item in items:
    response = client.messages.create(
        model="claude-opus-4",
        messages=[{"role": "user", "content": item}]
    )

# Prompt injection risk
prompt += f"The user said: {user_input}"
