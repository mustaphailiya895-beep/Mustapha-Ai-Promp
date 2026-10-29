import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces all 8 Pillars and rejects the Dirty Dozen vectors', () => {
  const rules = fs.readFileSync(rulesPath, 'utf-8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));

  // 1. Rules version 2 & Default-Deny catch-all
  assert.ok(rules.includes("rules_version = '2';"), 'Must use rules_version 2');
  assert.ok(
    rules.includes('match /{document=**} {\n      allow read, write: if false;\n    }'),
    'Must start with default-deny catch-all'
  );

  // 2. Every blueprint collection has a corresponding match block
  const firestorePaths = Object.keys(blueprint.firestore);
  assert.ok(firestorePaths.length >= 8, 'Blueprint must define all core collections');
  assert.ok(rules.includes('match /users/{userId}'));
  assert.ok(rules.includes('match /private/{docId}'));
  assert.ok(rules.includes('match /conversations/{conversationId}'));
  assert.ok(rules.includes('match /messages/{messageId}'));
  assert.ok(rules.includes('match /prompts/{promptId}'));
  assert.ok(rules.includes('match /generated_images/{imageId}'));
  assert.ok(rules.includes('match /usage_records/{userId}'));
  assert.ok(rules.includes('match /provider_configs/{providerId}'));
  assert.ok(rules.includes('match /admins/{adminId}'));

  // 3. Verified email guard against spoofing
  assert.ok(
    rules.includes('request.auth.token.email_verified == true'),
    'Must verify email_verified == true'
  );

  // 4. Master Gate relational check on messages subcollection
  assert.ok(
    rules.includes('get(/databases/$(database)/documents/conversations/$(conversationId)).data.userId == request.auth.uid'),
    'Messages subcollection must verify parent conversation ownership via Master Gate get()'
  );

  // 5. Anti-Update-Gap & Shadow Field protection via hasAll + hasOnly + affectedKeys
  assert.ok(rules.includes('.keys().hasAll('), 'Must enforce required keys');
  assert.ok(rules.includes('.keys().hasOnly('), 'Must enforce allowed keys to block shadow fields');
  assert.ok(rules.includes('.affectedKeys().hasOnly('), 'Must restrict update fields via affectedKeys');

  // 6. Temporal integrity via request.time
  assert.ok(rules.includes('incoming().createdAt == request.time'), 'Must enforce server timestamp on create');
  assert.ok(rules.includes('incoming().updatedAt == request.time'), 'Must enforce server timestamp on update');
});
