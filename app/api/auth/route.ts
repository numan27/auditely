import { NextResponse } from 'next/server';

// Mock auth endpoint
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, password, refreshToken } = body;

    switch (action) {
      case 'login':
        // Mock login
        if (email && password) {
          return NextResponse.json({
            success: true,
            data: {
              token: 'mock-access-token',
              refreshToken: 'mock-refresh-token',
              user: {
                id: '1',
                email,
                name: 'John Doe',
              },
            },
          });
        }
        return NextResponse.json(
          { success: false, message: 'Invalid credentials' },
          { status: 401 }
        );

      case 'refresh':
        // Mock token refresh
        if (refreshToken) {
          return NextResponse.json({
            success: true,
            data: {
              token: 'new-mock-access-token',
              refreshToken: 'new-mock-refresh-token',
            },
          });
        }
        return NextResponse.json(
          { success: false, message: 'Invalid refresh token' },
          { status: 401 }
        );

      case 'logout':
        return NextResponse.json({
          success: true,
          message: 'Logged out successfully',
        });

      default:
        return NextResponse.json(
          { success: false, message: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    );
  }
}
