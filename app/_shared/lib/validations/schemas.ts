import * as Yup from 'yup';
import { passwordProblem } from '@/app/_shared/lib/auth/passwordRules';

// Email validation regex
const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Password validation - at least 8 chars, 1 uppercase, 1 lowercase, 1 number
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\W]{8,}$/;

// Login schema
export const loginSchema = Yup.object().shape({
  email: Yup.string()
    .matches(emailRegex, 'Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  rememberMe: Yup.boolean(),
});

// Sign-in schema (an emailed link)
export const emailLinkSchema = Yup.object().shape({
  email: Yup.string()
    .trim()
    .matches(emailRegex, 'Enter your email address')
    .required('Enter your email address'),
});

// Sign-in schema (an email and the password set in Settings)
export const passwordSignInSchema = emailLinkSchema.shape({
  password: Yup.string().required('Enter your password'),
});

// Sign-up schema (an email and a new password, by the server's rules)
export const signupSchema = emailLinkSchema.shape({
  password: Yup.string()
    .required('Choose a password')
    .test('password-rules', '', function (value) {
      const problem = passwordProblem(value ?? '');
      return problem ? this.createError({ message: problem }) : true;
    }),
});

// Registration schema
export const registerSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .required('Name is required'),
  email: Yup.string()
    .matches(emailRegex, 'Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .matches(passwordRegex, 'Password must contain at least 8 characters, one uppercase, one lowercase, and one number')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
  termsAccepted: Yup.boolean()
    .oneOf([true], 'You must accept the terms and conditions'),
});

// Forgot password schema
export const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .matches(emailRegex, 'Invalid email address')
    .required('Email is required'),
});

// Reset password schema
export const resetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .matches(passwordRegex, 'Password must contain at least 8 characters, one uppercase, one lowercase, and one number')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

// Profile update schema
export const profileSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be less than 50 characters')
    .required('Name is required'),
  email: Yup.string()
    .matches(emailRegex, 'Invalid email address')
    .required('Email is required'),
});

// Change password schema
export const changePasswordSchema = Yup.object().shape({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string()
    .matches(passwordRegex, 'Password must contain at least 8 characters, one uppercase, one lowercase, and one number')
    .notOneOf([Yup.ref('currentPassword')], 'New password must be different from current password')
    .required('New password is required'),
  confirmNewPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm new password is required'),
});

// Contact form schema
export const contactSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Name must be at least 2 characters')
    .required('Name is required'),
  email: Yup.string()
    .matches(emailRegex, 'Invalid email address')
    .required('Email is required'),
  subject: Yup.string()
    .min(5, 'Subject must be at least 5 characters')
    .required('Subject is required'),
  message: Yup.string()
    .min(10, 'Message must be at least 10 characters')
    .max(1000, 'Message must be less than 1000 characters')
    .required('Message is required'),
});

// Types
export type LoginFormValues = Yup.InferType<typeof loginSchema>;
export type EmailLinkFormValues = Yup.InferType<typeof emailLinkSchema>;
export type PasswordSignInFormValues = Yup.InferType<typeof passwordSignInSchema>;
export type SignupFormValues = Yup.InferType<typeof signupSchema>;
export type RegisterFormValues = Yup.InferType<typeof registerSchema>;
export type ForgotPasswordFormValues = Yup.InferType<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = Yup.InferType<typeof resetPasswordSchema>;
export type ProfileFormValues = Yup.InferType<typeof profileSchema>;
export type ChangePasswordFormValues = Yup.InferType<typeof changePasswordSchema>;
export type ContactFormValues = Yup.InferType<typeof contactSchema>;
