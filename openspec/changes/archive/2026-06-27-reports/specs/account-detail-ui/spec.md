# Delta for Account Detail UI

## ADDED Requirements

### Requirement: Readonly Mode for Report Viewing

The system MUST support a readonly mode for viewing closed account details from the reports section.

(Previously: Account detail had no readonly mode; all accounts showed action buttons regardless of source.)

#### Scenario: View closed account in readonly mode

- GIVEN a user navigates to account detail from a shift report
- WHEN the URL contains `?readonly=1`
- THEN the system MUST hide all action buttons (add item, decrement item, close account, register payment)
- AND display account name, items, and total in read-only format
- AND allow navigation back to the shift detail

#### Scenario: Normal mode when readonly param absent

- GIVEN a user navigates to account detail without the readonly param
- WHEN the account detail page loads
- THEN the system MUST show all action buttons as before
- AND existing functionality remains unchanged
