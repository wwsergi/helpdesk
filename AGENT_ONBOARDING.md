# HelpDesk Agent Onboarding Guide

Welcome to the HelpDesk system! This guide will help you understand all the features available to you as an Agent, as well as the step-by-step processes for creating and managing tickets and sub-tickets.

---

## 1. Agent Functionalities overview

As an Agent, you have access to a variety of tools within the HelpDesk system. You can navigate through these using the top navigation bar or sidebar menus:

- **Dashboard**: A quick overview of your metrics and urgent tasks.
- **Inbox**: Your main workspace where you can view, filter, and search for tickets.
  - **Quick Filters**: View "All", "My Tickets", or "Unassigned".
  - **Advanced Filters**: Filter by Status, Assigned Agent, and Date ranges.
  - **Search**: Find specific tickets quickly.
- **Ticket Detail View**: Evaluate a specific ticket.
  - Change ticket properties (Status, Priority, Type, Queue, Category).
  - Assign the ticket to yourself or another agent.
  - Reply to the customer or leave **Internal Notes** (hidden from the customer).
  - Upload attachments.
- **Customers (Contacts)**: View and manage customer information.
- **Categories**: View the 3-level categorisation system to correctly label tickets.
- **Troubleshooting (Knowledge Base)**: Access internal guides to help resolve issues faster.

*(Note: "Agents" and "Reports" sections are restricted to Administrators).*

---

## 2. Managing Tickets: Creation and Assignment Flow

### Creating a New Ticket
If a customer reaches out via phone, standard email, or in-person, you might need to create a ticket manually:

1. Go to your **Inbox** (`/agent/inbox`).
2. Click the **"Create Ticket"** button in the top right corner.
3. A modal will appear. Fill in the required details (e.g., Customer/Contact, Subject, Description, Priority).
4. Save to generate the ticket. It will instantly appear in the Inbox.

### Assigning a Ticket
To ensure accountability, tickets must be assigned to the correct agent.

1. Open a ticket from the **Inbox** by clicking on it.
2. Look for the **"Assigned To"** dropdown in the right-hand **Ticket Details** sidebar.
3. Select an agent from the list (or select yourself).
4. The system updates the ticket assignment immediately. You can view all your assigned tickets by clicking the **"My Tickets"** filter in the Inbox.

---

## 3. Managing Sub-Tickets (Task Delegation)

Sometimes a ticket requires input or work from another specific agent (e.g., escalating to L2 support, or asking a specialist to handle a sub-task). In HelpDesk, you can **Delegate** this work by creating a Sub-Ticket.

### Creating and Assigning a Sub-Ticket
1. Open the primary ticket you're working on.
2. In the right-hand action menu or from the **"Sub-tickets"** tab at the top of the main area, click **"Delegate / Create Sub-Ticket"**.
3. A modal will open asking for details:
   - **Assign To**: Select the agent you want to delegate the work to.
   - **Priority**: Set the priority level for this specific sub-task.
   - **Comment**: Write instructions, context, or the question you need answered by the assigned agent. This comment will be visible in the conversation timeline.
4. Click **"Create Sub-Ticket"**.

### How Sub-Tickets Work
- **Visibility**: The parent ticket will now show a badge in the Inbox indicating it has sub-tickets. 
- **Sub-Ticket Tab**: Back in the Ticket Detail view, you can check the "Sub-tickets" tab to see the status and assignee of all delegated work for that ticket.
- **Unified Timeline**: All messages sent inside a sub-ticket merge into the parent ticket's main **Conversation** thread so you never lose context.
- **Internal Note Enforcement**: To prevent confusing the customer, all replies made by agents inside a sub-ticket are strictly forced to be **Internal Notes**. The customer will NEVER see internal communication happening on a sub-ticket.

---

*Thank you for helping us provide excellent support! If you have any additional questions about using the HelpDesk platform, refer to the Troubleshooting section or contact an Administrator.*
