# Controlled-pilot browser checklist

| Route | Role/data | Action | Expected result | Viewport |
| --- | --- | --- | --- | --- |
| `/dashboard` | New owner | Sign in | Setup state, no financial metrics | Desktop + mobile |
| `/dashboard` | Established owner | Sign in | Four collection metrics and safe action links | Desktop + mobile |
| `/invoices/new` | Invoice creator | Create invoice | Detail route and sharing next action | Desktop + mobile |
| `/payments` | Reviewer with pending proof | Open default | Pending review work visible | Desktop |
| `/pay/<token>` | Valid public link | Upload allowed proof | Truthful review confirmation | Mobile + Arabic/RTL |
| `/pay/<invalid>` | Logged out | Open | Safe generic unavailable response | Mobile |
| `/receipt/<token>` | Valid receipt | Open | Receipt remains accessible | Mobile |

For every route: check console errors, failed requests, dialogs, keyboard navigation, and horizontal overflow. These checks are not yet marked as executed.
