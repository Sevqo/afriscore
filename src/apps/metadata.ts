const kinds=['business','personal'] as const;
export const appRouteKinds:Record<string,readonly string[]>={
 'GET /organizations/:org/apps':kinds,
 'GET /organizations/:org/apps/:app/installation-preview':kinds,
 'POST /organizations/:org/apps/:app/install':kinds,
 'GET /organizations/:org/apps/:app/uninstallation-preview':kinds,
 'POST /organizations/:org/apps/:app/uninstall':kinds,
 'PATCH /organizations/:org/apps/:app/preferences':kinds,
 'GET /organizations/:org/apps/:app/history':kinds,
};
export const appPolicies=Object.fromEntries(Object.keys(appRouteKinds).map(key=>[key,{services:[] as string[]}]));
