import type{Metadata}from"next";import"./globals.css";import"leaflet/dist/leaflet.css";
export const metadata:Metadata={title:"CommunityConnect · Small actions. Shared progress.",description:"Report public concerns, follow community progress, discover opportunities, and share skills in Benue.",manifest:"/manifest.webmanifest",icons:{icon:"/favicon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return<html lang="en"><body>{children}</body></html>;}
