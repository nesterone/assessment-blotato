/**
 * Deterministic UUIDs referenced from seed + tests. Keeping them in one place
 * so seed inserts and test assertions can't drift.
 */

export const fixtures = {
  users: {
    primary: '11111111-1111-4111-8111-111111111111',
    other: '22222222-2222-4222-8222-222222222222',
  },
  apiKeys: {
    primary: 'aaaaaaaa-1111-4111-8111-000000000001',
    revoked: 'aaaaaaaa-1111-4111-8111-000000000002',
    other: 'aaaaaaaa-2222-4222-8222-000000000001',
  },
  connectedAccounts: {
    instagram: 'cccccccc-1111-4111-8111-000000000001',
    tiktok: 'cccccccc-1111-4111-8111-000000000002',
    otherInstagram: 'cccccccc-2222-4222-8222-000000000001',
  },
  posts: {
    a: 'aaaa0000-0000-4000-8000-00000000000a',
    b: 'aaaa0000-0000-4000-8000-00000000000b',
    other: 'aaaa0000-0000-4000-8000-0000000000ff',
  },
  platformPosts: {
    aInstagram: 'bbbb0000-0000-4000-8000-00000000000a',
    aTiktok: 'bbbb0000-0000-4000-8000-00000000000b',
    bInstagram: 'bbbb0000-0000-4000-8000-00000000000c',
    otherInstagram: 'bbbb0000-0000-4000-8000-0000000000ff',
  },
  comments: {
    // top-level third-party comments on post A / instagram
    aIg1: 'dddd0000-0000-4000-8000-00000000a101',
    aIg2: 'dddd0000-0000-4000-8000-00000000a102',
    aIg3: 'dddd0000-0000-4000-8000-00000000a103',
    aIg4: 'dddd0000-0000-4000-8000-00000000a104',
    // top-level third-party comments on post A / tiktok
    aTt1: 'dddd0000-0000-4000-8000-00000000a201',
    aTt2: 'dddd0000-0000-4000-8000-00000000a202',
    aTt3: 'dddd0000-0000-4000-8000-00000000a203',
    // top-level third-party comments on post B / instagram
    bIg1: 'dddd0000-0000-4000-8000-00000000b101',
    bIg2: 'dddd0000-0000-4000-8000-00000000b102',
    bIg3: 'dddd0000-0000-4000-8000-00000000b103',
    // our replies
    ourReplySent: 'dddd0000-0000-4000-8000-000000000e01',
    ourReplyPending: 'dddd0000-0000-4000-8000-000000000e02',
    // nested reply to aIg1
    nestedThirdParty: 'dddd0000-0000-4000-8000-000000000f01',
    // other user's comment
    otherUsersComment: 'dddd0000-0000-4000-8000-0000000000ff',
  },
} as const;
