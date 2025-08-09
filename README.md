...existing content...
# Webscape - RuneScape 2004 Chat Re-creation

How to run:
- Open index.html in a modern browser (Chrome/Edge/Firefox).
- Choose a username and world.
- Open another tab with a different username to see real-time chat via BroadcastChannel (no server required).

Features implemented:
- Real-time public and private chat (BroadcastChannel across tabs).
- System messages (login/logout).
- Split chat toggle (public/system vs private).
- Friends and Ignore list with real-time updates and persistence (localStorage).
- Context menu on username (Add Friend / Add Ignore / Message / Remove Friend).
- Pop-up modals for add/remove and sending private messages.
- Click outside UI, click the viewport iframe, or press ESC to close modals/context/input highlight.
- "Database" uniqueness: exactly one entry per username is stored and updated in localStorage.

Notes:
- This project simulates a backend. For production, replace serverSim.js with a true WebSocket server.
- Basic sanitization is applied when rendering chat to prevent XSS.

