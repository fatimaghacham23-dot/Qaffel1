import type { WorkspaceRole } from "@/lib/permissions";
export type TeamRosterPerson={key:string;displayName:string;email:string|null;role:WorkspaceRole;status:"active"|"inactive";isOwner:boolean;canChangeRole:boolean;canRemove:boolean};
export type TeamRosterInvitation={key:string;email:string;role:string;status:string};
export type TeamRoster={owner:TeamRosterPerson|null;members:TeamRosterPerson[];pendingInvitations:TeamRosterInvitation[];totalPeople:number;additionalMemberCount:number;pendingInvitationCount:number};
type Profile={fullName?:string|null;email?:string|null};
type Membership={workspaceId:string;userId:string;role:WorkspaceRole;status:string;profile?:Profile|null};
type Invitation={key:string;email:string;role:string;status:string};
export type TeamRosterInput={workspaceId:string;ownerId:string|null;ownerProfile?:Profile|null;memberships:Membership[];pendingInvitations?:Invitation[];viewerRole:WorkspaceRole};
const active=(status:string)=>status==="active";
const name=(profile:Profile|undefined|null)=>profile?.fullName?.trim()||"Workspace owner";
export function deriveTeamRoster(input:TeamRosterInput):TeamRoster{
 const ownerMembership=input.ownerId?input.memberships.find(m=>m.workspaceId===input.workspaceId&&m.userId===input.ownerId&&m.status!=="removed"):undefined;
 const owner=input.ownerId?{key:"owner",displayName:name(input.ownerProfile||ownerMembership?.profile),email:input.ownerProfile?.email||ownerMembership?.profile?.email||null,role:"owner" as WorkspaceRole,status:active(ownerMembership?.status||"active")?"active" as const:"inactive" as const,isOwner:true,canChangeRole:false,canRemove:false}:null;
 const canManage=["owner","admin"].includes(input.viewerRole);
 const seen=new Set<string>();
 const members=input.memberships.filter(m=>m.workspaceId===input.workspaceId&&m.userId!==input.ownerId&&active(m.status)&&!seen.has(m.userId)&&(seen.add(m.userId),true)).map(m=>({key:`member:${m.userId}`,displayName:name(m.profile),email:m.profile?.email||null,role:m.role,status:"active" as const,isOwner:false,canChangeRole:canManage,canRemove:canManage})).sort((a,b)=>a.displayName.localeCompare(b.displayName));
 const invitations=(input.pendingInvitations||[]).filter(i=>i.status==="pending").map(i=>({...i}));
 return {owner,members,pendingInvitations:invitations,totalPeople:(owner?1:0)+members.length,additionalMemberCount:members.length,pendingInvitationCount:invitations.length};
}