# ProfSyn AI Documentation

## Overview
ProfSyn AI is a Danish-language AI assistant built on OpenAI's API. It provides three specialized modes:
- **Normal chat** - General Q&A and text improvement
- **Email preparation** - Format text as professional Danish emails
- **Objection review** - Structure complaints and objections

## Environment Setup

### Required Secret
Set in Supabase Edge Functions secrets:
- `OPENAI_API_KEY` - Your OpenAI API key

### Configuration
Located in `supabase/functions/profsyn-ai-query/index.ts`:

```typescript
model: 'gpt-4o-mini'        // Fast, cost-effective model
temperature: 0.3            // Low = consistent, focused responses
max_completion_tokens: 900  // ~225 words per response
stream: true                // Default streaming enabled
```

### Changing Model
Replace `gpt-4o-mini` with:
- `gpt-4.1-mini-2025-04-14` - Higher quality, more expensive
- `gpt-4o` - Maximum quality, highest cost

### Adjusting Temperature
- `0.1-0.3` - Factual, consistent (current)
- `0.4-0.7` - Balanced creativity
- `0.8-1.0` - More creative, varied

### Token Limits
Adjust `max_completion_tokens` (900 = ~225 words):
- Increase for longer responses (costs more)
- Decrease for shorter, cheaper responses

## Chat History

### Storage
- Uses browser `localStorage`
- Max 5 sessions stored
- Key: `profsyn-ai-sessions`

### Session Structure
```typescript
{
  id: string,              // UUID
  title: string,           // Auto from first message
  messages: Message[],
  timestamp: number,       // Creation
  lastUpdated: number      // Last message
}
```

### Clearing History
Users can:
- Delete individual sessions (trash icon)
- Clear current conversation (starts new session)

## Specialized Modes

### Email Mode
**Trigger:** "Forbedr og klargør til mail" button

**Output Format:**
```
Emne: [Subject line]
Mail:
[Professional body text]
Underskrift: —
```

**Use case:** Convert rough notes into formal emails

### Objection Mode
**Trigger:** "Gennemgå som indsigelse" button

**Output Format:**
```
Titel: [Max 8 words]
Baggrund: [Brief context]
Problem: [Issue description]
Argumenter:
- [Point 1]
- [Point 2]
- [Point 3]
Anmodning: [Request]
Næste skridt:
- [Action 1]
- [Action 2]
```

**Use case:** Structure complaints and formal objections

## Security & Privacy

### Data Handling
- **No server-side storage** - All chats are local only
- **API calls** - Only message content sent to OpenAI
- **localStorage** - Persists between sessions (same browser)

### API Key Protection
- Stored in Supabase secrets (never exposed client-side)
- Accessed only in edge function
- Not logged or exposed in errors

## Rate Limiting
- 10 requests per minute per IP (edge function level)
- OpenAI API limits apply separately

## Error Messages (Danish)
- Network: "Netværksfejl. Tjek din forbindelse."
- API key: "API-nøgle mangler. Kontakt administratoren."
- Rate limit: "For mange anmodninger. Prøv igen om et øjeblik."
- Generic: "Der opstod en fejl. Prøv igen senere."

## Testing

### Basic Chat
1. Navigate to `/profsyn-ai`
2. Type: "Hej, hvem er du?"
3. Verify Danish response

### Email Mode
1. Enter: "Vi skal have møde om projektet næste uge"
2. Click "Forbedr og klargør til mail"
3. Verify formatted email output
4. Test "Kopiér som mail" button

### Objection Mode
1. Enter: "Jeg er uenig i min varslingsperiode på 3 måneder"
2. Click "Gennemgå som indsigelse"
3. Verify structured output
4. Test "Kopiér som indsigelse" button

### History
1. Send several messages
2. Open "Seneste samtaler" dropdown
3. Verify session appears with title and timestamp
4. Click "Åbn" to load session
5. Click "Ny samtale" to start fresh
6. Verify old session persists

## Troubleshooting

### "API-nøgle mangler"
- Verify `OPENAI_API_KEY` is set in Supabase secrets
- Redeploy edge function

### Streaming not working
- Check browser console for errors
- Verify CORS headers in edge function
- Test with streaming disabled (toggle in UI)

### localStorage full
- Clear browser data for domain
- Or delete old sessions manually via UI

### Slow responses
- Model: Try switching to `gpt-4o-mini` (fastest)
- Reduce `max_completion_tokens` to 500
- Disable streaming for faster perceived speed

## Future Enhancements
- Multi-user authentication
- Cloud storage for history
- Export conversations as PDF
- More specialized modes (e.g., meeting notes, technical docs)
