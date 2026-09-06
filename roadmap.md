# PyReview roadmap

- [x] Add a protected `_authenticated` layout and move Dashboard/History under it.
- [ ] Build a dedicated `/login` page (email, password, show/hide, clear errors).
- [ ] Build a dedicated `/signup` page (name, email, password, confirm password, validation).
- [ ] Update global navigation with session-aware login/signup/logout affordances.
- [ ] Wire root `onAuthStateChange` listener for cache/router invalidation on sign-in/out.
- [ ] Verify protected routes redirect when logged out and forms validate client-side.
- [ ] Address the "paused work" note from the user once auth is shipped.
