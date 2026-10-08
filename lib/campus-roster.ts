'use client';
import {supabase} from './supabase';
import {listCampusLeadProfiles,type CampusLeadProfile} from './platform';
import {friendly} from './koc';
export type RosterCampus={id:string;name:string;region:string;is_active:boolean;lifecycle_status:'active'|'inactive'|'in_process';cluster_id:string|null;latitude:number|null;longitude:number|null;meeting_info:string|null;address:string|null};
export type RosterLeader={id:string;campus_id:string;full_name:string;course:string|null;study_year_text:string|null;grade_label:string|null;training_attendance:string|null;portrait_data:string|null;source_page:number;source_row:number;account_id:string|null};
export type CampusRoster={campuses:RosterCampus[];leaders:RosterLeader[];primaryLeads:CampusLeadProfile[]};
export async function listCampusRoster():Promise<CampusRoster>{
 const [{data,error},primaryLeads]=await Promise.all([supabase().rpc('admin_campus_roster'),listCampusLeadProfiles()]);
 if(error)throw new Error(friendly(error));
 if(!data||!Array.isArray(data.campuses)||!Array.isArray(data.leaders))throw new Error('Unable to load campus roster.');
 return {campuses:data.campuses,leaders:data.leaders,primaryLeads};
}
