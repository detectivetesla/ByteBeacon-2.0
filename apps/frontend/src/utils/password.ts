export interface PasswordRequirement {
  id: 'min-length' | 'uppercase' | 'lowercase' | 'number' | 'special';
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: 'min-length',
    label: 'At least 8 characters',
    test: (pwd: string) => pwd.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'Uppercase letter (A-Z)',
    test: (pwd: string) => /[A-Z]/.test(pwd),
  },
  {
    id: 'lowercase',
    label: 'Lowercase letter (a-z)',
    test: (pwd: string) => /[a-z]/.test(pwd),
  },
  {
    id: 'number',
    label: 'Number (0-9)',
    test: (pwd: string) => /[0-9]/.test(pwd),
  },
  {
    id: 'special',
    label: 'Special symbol (!@#$%...)',
    test: (pwd: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
  },
];

export interface PasswordRuleStatus {
  id: string;
  label: string;
  passed: boolean;
}

export interface PasswordStrength {
  score: number; // 0 to 5
  label: string;
  color: string;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number;
  strength: PasswordStrength;
  rules: PasswordRuleStatus[];
  error?: string;
}

export function validatePassword(password: string = ''): PasswordValidationResult {
  const passwordStr = typeof password === 'string' ? password : '';
  const rules = PASSWORD_REQUIREMENTS.map((req) => ({
    id: req.id,
    label: req.label,
    passed: req.test(passwordStr),
  }));

  const passedCount = rules.filter((r) => r.passed).length;

  const getStrength = (count: number, len: number): PasswordStrength => {
    if (len === 0) return { score: 0, label: 'No password', color: 'var(--color-text-muted)' };
    if (count <= 2) return { score: count, label: 'Weak', color: 'var(--color-danger)' };
    if (count === 3) return { score: count, label: 'Fair', color: '#F59E0B' };
    if (count === 4) return { score: count, label: 'Good', color: '#3B82F6' };
    return { score: 5, label: 'Strong & secure', color: 'var(--color-success)' };
  };

  const strength = getStrength(passedCount, passwordStr.length);
  const failedRule = rules.find((r) => !r.passed);

  let error: string | undefined;
  if (!passwordStr) {
    error = 'Password is required';
  } else if (failedRule) {
    if (failedRule.id === 'min-length') {
      error = 'Password must be at least 8 characters long';
    } else if (failedRule.id === 'uppercase') {
      error = 'Password must contain at least one uppercase letter';
    } else if (failedRule.id === 'lowercase') {
      error = 'Password must contain at least one lowercase letter';
    } else if (failedRule.id === 'number') {
      error = 'Password must contain at least one number';
    } else if (failedRule.id === 'special') {
      error = 'Password must contain at least one special symbol';
    }
  }

  return {
    isValid: passedCount === PASSWORD_REQUIREMENTS.length,
    score: passedCount,
    strength,
    rules,
    error,
  };
}
