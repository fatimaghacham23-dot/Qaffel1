import {
  initialsForName,
  type AssignmentMemberOption,
  type AssignmentNoteRow,
  type AssignmentTargetType,
  type OperationalAssignmentRow
} from "@/lib/assignments";
import type { WorkspaceRole } from "@/lib/permissions";

type SupabaseLike = {
  from: (table: string) => any;
};

type ProfileRow = {
  id: string;
  full_name?: string | null;
  business_name?: string | null;
};

function profileName(profile: ProfileRow | null | undefined, fallback = "Workspace member") {
  return profile?.full_name || profile?.business_name || fallback;
}

export async function getAssignmentMembers(supabase: SupabaseLike, workspaceId: string): Promise<AssignmentMemberOption[]> {
  const { data: memberRows } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", workspaceId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  const members = ((memberRows || []) as Array<{ user_id: string; role: WorkspaceRole }>).filter((member) => Boolean(member.user_id));
  const userIds = members.map((member) => member.user_id);
  const profileMap = await getProfileMap(supabase, userIds);

  return members.map((member) => {
    const name = profileName(profileMap.get(member.user_id), "Workspace member");
    return {
      userId: member.user_id,
      name,
      role: member.role,
      initials: initialsForName(name)
    };
  });
}

export async function getProfileMap(supabase: SupabaseLike, userIds: string[]) {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map<string, ProfileRow>();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, business_name")
    .in("id", unique);

  return new Map(((data || []) as ProfileRow[]).map((profile) => [profile.id, profile]));
}

export async function hydrateAssignments(input: {
  supabase: SupabaseLike;
  assignments: OperationalAssignmentRow[];
  members: AssignmentMemberOption[];
}) {
  const { supabase, assignments, members } = input;
  if (assignments.length === 0) return [];

  const ids = assignments.map((assignment) => assignment.id);
  const { data: noteRows } = await supabase
    .from("assignment_notes")
    .select("id, assignment_id, note_type, body, created_at, author_id")
    .in("assignment_id", ids)
    .order("created_at", { ascending: false });

  const notes = (noteRows || []) as Array<AssignmentNoteRow & { author_id?: string | null }>;
  const authorMap = await getProfileMap(
    supabase,
    notes.map((note) => note.author_id || "").filter(Boolean)
  );
  const memberMap = new Map(members.map((member) => [member.userId, member]));
  const notesByAssignment = new Map<string, AssignmentNoteRow[]>();

  for (const note of notes) {
    const author = note.author_id ? authorMap.get(note.author_id) : null;
    const list = notesByAssignment.get(note.assignment_id) || [];
    list.push({
      id: note.id,
      assignment_id: note.assignment_id,
      note_type: note.note_type,
      body: note.body,
      created_at: note.created_at,
      author_name: profileName(author, "Teammate")
    });
    notesByAssignment.set(note.assignment_id, list);
  }

  return assignments.map((assignment) => {
    const member = assignment.assigned_to_user_id ? memberMap.get(assignment.assigned_to_user_id) : null;
    const assignmentNotes = notesByAssignment.get(assignment.id) || [];
    return {
      ...assignment,
      assigned_to_name: member?.name || assignment.assigned_to_name || null,
      assigned_to_initials: member?.initials || assignment.assigned_to_initials || null,
      notes: assignmentNotes,
      note_count: assignmentNotes.length
    };
  });
}

export async function getAssignmentsForTarget(input: {
  supabase: SupabaseLike;
  workspaceId: string;
  targetType: AssignmentTargetType;
  targetId: string;
  members?: AssignmentMemberOption[];
}) {
  const members = input.members || (await getAssignmentMembers(input.supabase, input.workspaceId));
  const { data } = await input.supabase
    .from("operational_assignments")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .order("created_at", { ascending: false });

  return hydrateAssignments({
    supabase: input.supabase,
    assignments: (data || []) as OperationalAssignmentRow[],
    members
  });
}

export async function getAssignmentsForTargets(input: {
  supabase: SupabaseLike;
  workspaceId: string;
  targetType: AssignmentTargetType;
  targetIds: string[];
  members?: AssignmentMemberOption[];
}) {
  const targetIds = Array.from(new Set(input.targetIds.filter(Boolean)));
  if (targetIds.length === 0) return new Map<string, OperationalAssignmentRow[]>();

  const members = input.members || (await getAssignmentMembers(input.supabase, input.workspaceId));
  const { data } = await input.supabase
    .from("operational_assignments")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .eq("target_type", input.targetType)
    .in("target_id", targetIds)
    .order("created_at", { ascending: false });

  const hydrated = await hydrateAssignments({
    supabase: input.supabase,
    assignments: (data || []) as OperationalAssignmentRow[],
    members
  });
  const byTarget = new Map<string, OperationalAssignmentRow[]>();
  for (const assignment of hydrated) {
    const list = byTarget.get(assignment.target_id) || [];
    list.push(assignment);
    byTarget.set(assignment.target_id, list);
  }
  return byTarget;
}

export async function getWorkspaceAssignments(input: {
  supabase: SupabaseLike;
  workspaceId: string;
  members?: AssignmentMemberOption[];
}) {
  const members = input.members || (await getAssignmentMembers(input.supabase, input.workspaceId));
  const { data } = await input.supabase
    .from("operational_assignments")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .order("created_at", { ascending: false });

  return hydrateAssignments({
    supabase: input.supabase,
    assignments: (data || []) as OperationalAssignmentRow[],
    members
  });
}

