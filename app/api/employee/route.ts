import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/employee — list all employees or find by email/id
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const id = searchParams.get("id") || searchParams.get("employeeId");

    if (email) {
      const [employee] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, email.toLowerCase().trim()),
            eq(users.role, "employee")
          )
        );
      if (!employee) {
        return NextResponse.json({ error: "Employee not found" }, { status: 404 });
      }
      return NextResponse.json({ employee });
    }

    if (id) {
      const parsedId = Number(id);
      if (!isNaN(parsedId)) {
        const [employee] = await db
          .select()
          .from(users)
          .where(and(eq(users.id, parsedId), eq(users.role, "employee")));
        if (!employee) {
          return NextResponse.json({ error: "Employee not found" }, { status: 404 });
        }
        return NextResponse.json({ employee });
      }
    }

    const employees = await db
      .select()
      .from(users)
      .where(eq(users.role, "employee"));
    return NextResponse.json({ employees, count: employees.length });
  } catch (error: any) {
    console.error("GET /api/employee error:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees", detail: error?.message },
      { status: 500 }
    );
  }
}

// POST /api/employee — add or upsert employee into users table
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      employeeName,
      name,
      employeeEmail,
      email,
      employeePassword,
      password,
      role,
      department,
      salary,
    } = body;

    const finalEmail = (employeeEmail || email || "").toLowerCase().trim();
    const finalName = (employeeName || name || "").trim();
    const finalPassword = (employeePassword || password || "").trim();
    const finalRole = (role || "employee").toLowerCase().trim();
    const finalDepartment = (department || "General").trim();
    const finalSalary = salary !== undefined && salary !== null ? Number(salary) : 0;

    if (!finalEmail || !finalPassword || !finalName) {
      return NextResponse.json(
        { error: "name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if user exists by email
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, finalEmail));

    let savedEmployee;
    if (existing.length > 0) {
      const [updated] = await db
        .update(users)
        .set({
          name: finalName,
          password: finalPassword,
          role: finalRole,
          department: finalDepartment,
          salary: finalSalary,
        })
        .where(eq(users.email, finalEmail))
        .returning();
      savedEmployee = updated;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          name: finalName,
          email: finalEmail,
          password: finalPassword,
          role: finalRole,
          department: finalDepartment,
          salary: finalSalary,
        })
        .returning();
      savedEmployee = inserted;
    }

    return NextResponse.json({
      message: "Employee saved successfully in users table",
      employee: savedEmployee,
    });
  } catch (error: any) {
    console.error("POST /api/employee error:", error);
    return NextResponse.json(
      { error: "Failed to save employee", detail: error?.message },
      { status: 500 }
    );
  }
}

// DELETE /api/employee — delete employee by email or id
export async function DELETE(request: NextRequest) {
  try {
    let email: string | null = null;
    let id: string | null = null;

    const { searchParams } = new URL(request.url);
    email = searchParams.get("email");
    id = searchParams.get("id") || searchParams.get("employeeId");

    if (!email && !id) {
      try {
        const body = await request.json();
        email = body.email || body.employeeEmail;
        id = body.id || body.employeeId;
      } catch {
        // no body provided
      }
    }

    if (!email && !id) {
      return NextResponse.json(
        { error: "email or id is required for deletion" },
        { status: 400 }
      );
    }

    let deleted;
    if (email) {
      deleted = await db
        .delete(users)
        .where(
          and(
            eq(users.email, email.toLowerCase().trim()),
            eq(users.role, "employee")
          )
        )
        .returning();
    } else if (id) {
      const parsedId = Number(id);
      if (!isNaN(parsedId)) {
        deleted = await db
          .delete(users)
          .where(and(eq(users.id, parsedId), eq(users.role, "employee")))
          .returning();
      }
    }

    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Employee deleted successfully",
      deletedEmployee: deleted[0],
    });
  } catch (error: any) {
    console.error("DELETE /api/employee error:", error);
    return NextResponse.json(
      { error: "Failed to delete employee", detail: error?.message },
      { status: 500 }
    );
  }
}
