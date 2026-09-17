'use strict';

// Synthetic data only. Never connect this provider to a live writer.
function createDemo() {
  const contacts = [{ id: 900001, firstName: 'Alex', lastName: 'Example', stage: 'Showing homes', assignedUserId: 900010, assignedTo: 'Blaise Smith', price: 350000, assignedLenderName: null, background: 'Fictional demo buyer. Looking for a home with room to work from home. Comfortable price and financing need confirmation.', tags: ['Buyer'], updated: '2026-09-15T15:00:00Z' }];
  const notes = [{ id: 900020, personId: 900001, subject: 'Synthetic search context', body: 'Client reported wanting an easier commute. Bedrooms, condition tolerance and a firm comfortable price have not yet been confirmed.', created: '2026-09-15T15:00:00Z' }];
  const tasks = [];
  let next = 900030;
  return async (name, a) => {
    let result;
    switch (name) {
      case 'get_users': result = { users: [{ id: 900010, name: 'Blaise Smith' }] }; break;
      case 'get_stages': result = { stages: [{ name: 'Showing homes' }] }; break;
      case 'find_contact': result = { people: contacts, _metadata: { total: 1, next: null } }; break;
      case 'get_contact': result = contacts.find(c => c.id === a.person_id); break;
      case 'get_contact_notes': result = { notes: notes.filter(n => n.personId === a.person_id).slice().reverse(), _metadata: { total: notes.length, next: null } }; break;
      case 'get_open_tasks': result = { tasks: tasks.filter(t => t.personId === a.person_id), _completeness: { has_more: false, capped: false, returned_count: tasks.length, total_count: tasks.length } }; break;
      case 'create_contact_note': {
        if (a.execute !== true) throw new Error('Demo expects the review path.');
        const n = { id: next++, personId: a.person_id, subject: a.subject, body: a.body, created: new Date().toISOString() };
        notes.push(n); result = { status: 'WRITE_COMPLETED_AND_RE_READ', created: n }; break;
      }
      case 'create_contact_task': {
        if (a.execute !== true) throw new Error('Demo expects the review path.');
        const t = { id: next++, personId: a.person_id, assignedUserId: a.assigned_user_id, name: a.name, type: a.task_type, dueDate: a.due_date };
        tasks.push(t); result = { status: 'WRITE_COMPLETED_AND_RE_READ', created: t }; break;
      }
      case 'update_contact_task': {
        const t = tasks.find(t => t.id === a.task_id && t.personId === a.expected_person_id && t.name === a.expected_task_name);
        if (!t || a.execute !== true) throw new Error('Task changed.');
        t.name = a.new_name; t.dueDate = a.new_due_date;
        result = { status: 'WRITE_COMPLETED_AND_RE_READ', after: t }; break;
      }
      default: throw new Error('Unsupported demo operation.');
    }
    if (!result) throw new Error('Synthetic contact not found.');
    return { structuredContent: structuredClone(result) };
  };
}
module.exports = { createDemo };
