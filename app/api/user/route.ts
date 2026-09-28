import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { NextResponse } from "next/server";
import { db, users } from "@/db";
import { User } from "lucide-react";

export async function POST(){
    
    try {
        const session=await getServerSession(authOptions);

    if(!session?.user?.email){
      return NextResponse.json("unauthorized");
    }
        const result=await db.insert(users).values({
            name:session?.user?.name,
            email:session?.user?.email,
        }).onConflictDoNothing({
            target:users.email
        }).returning();

        if(result.length==0){
            return NextResponse.json({"message":"user is already exist"});
        }

        return NextResponse.json({"message":"User is created successfully"});
    } catch (error) {
        return Response.json({"message":"Auth error"})
    }
}