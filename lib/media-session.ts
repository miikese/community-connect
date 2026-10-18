let active:string|null=null;
export function claimMediaSession(id:string){if(active&&active!==id)return false;active=id;return true}
export function releaseMediaSession(id:string){if(active===id)active=null}
export function hasMediaSession(){return active!==null}
