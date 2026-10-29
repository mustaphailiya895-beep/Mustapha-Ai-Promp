# MUSTAPHA AI PROMPT — Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default-Deny Global Gate**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split-Collection Isolation**: User email is isolated inside `/users/{userId}/private/{docId}` and is readable/writable strictly by the document owner (`request.auth.uid == userId`) or a verified administrator.
4. **Master Gate Relational Sync**: Every message in `/conversations/{conversationId}/messages/{messageId}` must verify via `get()` on `/conversations/$(conversationId)` that the parent conversation exists and its `userId == request.auth.uid`.
5. **Anti-Update-Gap & Strict Keys**: Every `create` and `update` invokes `isValid[Entity](incoming())`, enforcing `.keys().hasAll(...)` and `.keys().hasOnly(...)`, exact types, bounded string lengths, regex IDs (`^[a-zA-Z0-9_\-]+$`), immutable ownership fields (`userId`, `uid`, `createdAt`), and server timestamp integrity (`request.time`).
6. **Query Enforcer**: Every `allow list` rule restricts `resource.data.userId == request.auth.uid` without `get()`/`exists()` inside list blocks.

## 2. The "Dirty Dozen" Payloads (Adversarial Test Vectors)

1. **Shadow Field Injection on UserProfile**: `{ uid: "user_1", displayName: "Ali", theme: "dark", defaultModel: "gemini-3.8-flash", isAdmin: true, createdAt: SERVER_TIME, updatedAt: SERVER_TIME }` -> Rejected by `hasOnly`.
2. **Cross-User Profile Read**: Authenticated `user_2` attempts `get(/users/user_1)` -> Rejected by owner check.
3. **PII Leak Attempt**: Authenticated `user_2` attempts `get(/users/user_1/private/info)` -> Rejected by owner check.
4. **Unverified Email Write**: Token with `email_verified: false` attempts `create` on `/prompts/prompt_1` -> Rejected by `isVerified()`.
5. **Identity Spoofing on Conversation Create**: `user_1` creates conversation with `userId: "user_2"` -> Rejected by `data.userId == request.auth.uid`.
6. **Orphaned Message Write**: `user_1` creates message in `/conversations/non_existent/messages/msg_1` -> Rejected by Master Gate `exists`/`get` check on parent conversation.
7. **Immutable Field Mutation on Prompt Update**: `user_1` updates `/prompts/p_1` changing `createdAt` or `userId` -> Rejected by immutability guard (`incoming().createdAt == existing().createdAt`).
8. **Value Poisoning on Conversation Title**: `user_1` updates `title` with a 5,000-character string -> Rejected by `isValidConversation` maxLength `<= 200`.
9. **ID Poisoning Attack**: Document ID with spaces or special chars `bad id!@#` -> Rejected by `isValidId()`.
10. **Client Timestamp Forgery**: `createdAt` set to a past or future timestamp `request.time - 1000s` -> Rejected by `incoming().createdAt == request.time`.
11. **Blanket List Scraping**: `user_1` executes unconstrained `list` on `/prompts` without filtering `userId == request.auth.uid` -> Rejected by `resource.data.userId == request.auth.uid`.
12. **Privilege Escalation on Provider Config**: Non-admin `user_1` attempts to update `/provider_configs/gemini` -> Rejected by `isAdmin()`.
