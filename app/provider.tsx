"use client"

import { useSession } from 'next-auth/react'
import  React, { useEffect } from 'react'
import axios from "axios"
type Props = {}

export const Provider = ({ children }:{children: React.ReactNode}) => {
    const {data}=useSession();
    useEffect(()=>{
        data?.user?.email && createNewUser()
    },[data])
    const createNewUser=async()=>{
            try {
                const result=await axios.post("/api/user",{})
                console.log("the result is",result.data);
            } catch (error) {
                console.log("the error comes in Login");
            }
        }
  return (
    <div>{children}</div>
  )
}
