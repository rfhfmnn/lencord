import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RegisterForm } from '@/components/auth/RegisterForm';
import RegistroPage from '@/app/registro/page';

describe('Dedicated User Registration Page with Role Selection (Issue #27)', () => {
  let mockSignUp: any;
  let mockUpsert: any;
  let mockSupabaseClient: any;

  beforeEach(() => {
    mockSignUp = vi.fn();
    mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

    mockSupabaseClient = {
      auth: {
        signUp: mockSignUp,
      },
      from: vi.fn().mockReturnValue({
        upsert: mockUpsert,
      }),
    };
  });

  // ---------------------------------------------------------------------------
  // 1. Page & Layout Rendering (Design System Conformance)
  // ---------------------------------------------------------------------------
  it('route /registro renders accessible registration view with Header and Footer', () => {
    render(<RegistroPage />);

    expect(screen.getByTestId('sticky-header')).toBeInTheDocument();
    expect(screen.getByText(/Creá tu cuenta en Lencord/i)).toBeInTheDocument();
    expect(screen.getByTestId('role-tab-sme')).toBeInTheDocument();
    expect(screen.getByTestId('role-tab-investor')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 2. Role Selector Toggling (SME vs Investor)
  // ---------------------------------------------------------------------------
  it('toggles between "Soy Empresa (PyME)" and "Soy Inversor" tabs and displays corresponding fields', () => {
    render(<RegisterForm supabaseClient={mockSupabaseClient} />);

    // Default is SME (borrower)
    expect(screen.getByTestId('role-tab-sme')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText(/Razón social de la empresa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CUIT de la empresa/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre y apellido del apoderado/i)).toBeInTheDocument();
    expect(screen.getByTestId('submit-register-btn')).toHaveTextContent('Registrar mi empresa');

    // Toggle to Inversor
    fireEvent.click(screen.getByTestId('role-tab-investor'));

    expect(screen.getByTestId('role-tab-investor')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('role-tab-sme')).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByLabelText(/Nombre y apellido completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/DNI o CUIT tributario/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Razón social de la empresa/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('submit-register-btn')).toHaveTextContent('Crear cuenta de inversor');
  });

  // ---------------------------------------------------------------------------
  // 3. Form Validation (CUIT Checksum, Weak Password, Invalid Email)
  // ---------------------------------------------------------------------------
  it('displays inline accessible error messages when required fields are missing or empty', async () => {
    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="borrower"
        defaultTermsAccepted={true}
      />
    );

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(await screen.findByText(/La razón social o nombre de la empresa es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/El CUIT es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/El nombre del apoderado o representante es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/El correo electrónico es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/La contraseña es obligatoria/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('validates Argentine CUIT with check-digit algorithm and displays accessible error on invalid CUIT', async () => {
    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="borrower"
        defaultTermsAccepted={true}
      />
    );

    // Fill valid company and representative
    fireEvent.change(screen.getByLabelText(/Razón social de la empresa/i), {
      target: { value: 'Industrias Andinas S.A.' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre y apellido del apoderado/i), {
      target: { value: 'Carlos Mendoza' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico corporativo/i), {
      target: { value: 'carlos@andinas.com.ar' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'Segura123!' },
    });

    // Enter invalid CUIT with wrong check digit (30-50001091-9 instead of 2)
    fireEvent.change(screen.getByLabelText(/CUIT de la empresa/i), {
      target: { value: '30-50001091-9' },
    });

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(
      await screen.findByText(/El CUIT ingresado no es válido según el algoritmo de verificación oficial/i)
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('validates password strength and rejects passwords under 8 characters or lacking letters/numbers', async () => {
    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="investor"
        defaultTermsAccepted={true}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nombre y apellido completo/i), {
      target: { value: 'Esteban Quito' },
    });
    fireEvent.change(screen.getByLabelText(/DNI o CUIT tributario/i), {
      target: { value: '34123456' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'esteban@ejemplo.com' },
    });

    // Test password under 8 characters
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'pass1' },
    });
    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(await screen.findByText(/La contraseña debe tener al menos 8 caracteres/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();

    // Test password without numbers
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'sololetraslargas' },
    });
    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(await screen.findByText(/La contraseña debe incluir al menos una letra y un número/i)).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 4. Successful Registration Flow (SME & Investor with Supabase Auth & Profiles)
  // ---------------------------------------------------------------------------
  it('successfully registers SME borrower, calls signUp with role "borrower", and creates profile record', async () => {
    const mockUserId = 'usr-borrower-456';
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'contacto@techpyme.com.ar' },
        session: null,
      },
      error: null,
    });

    const handleSuccess = vi.fn();

    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="borrower"
        defaultTermsAccepted={true}
        onSuccess={handleSuccess}
      />
    );

    fireEvent.change(screen.getByLabelText(/Razón social de la empresa/i), {
      target: { value: 'Tech PyME S.A.S.' },
    });
    // Valid Argentine CUIT: 30-50001091-2
    fireEvent.change(screen.getByLabelText(/CUIT de la empresa/i), {
      target: { value: '30-50001091-2' },
    });
    fireEvent.change(screen.getByLabelText(/Nombre y apellido del apoderado/i), {
      target: { value: 'Mariana López' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico corporativo/i), {
      target: { value: 'contacto@techpyme.com.ar' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'PasswordSegura2026!' },
    });

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'contacto@techpyme.com.ar',
        password: 'PasswordSegura2026!',
        options: {
          data: {
            role: 'borrower',
            legal_name: 'Tech PyME S.A.S.',
            tax_id: '30500010912',
            representative_name: 'Mariana López',
          },
        },
      });
    });

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId,
          role: 'borrower',
          tax_id: '30500010912',
          legal_name: 'Tech PyME S.A.S.',
          email: 'contacto@techpyme.com.ar',
          first_name: 'Mariana López',
        })
      );
    });

    // Confirmation state is rendered
    expect(await screen.findByTestId('registration-confirmation')).toBeInTheDocument();
    expect(screen.getByText(/¡Verificá tu correo electrónico!/i)).toBeInTheDocument();
    expect(screen.getByText('contacto@techpyme.com.ar')).toBeInTheDocument();
    expect(handleSuccess).toHaveBeenCalledWith('contacto@techpyme.com.ar', 'borrower');
  });

  it('successfully registers Investor, calls signUp with role "investor", and creates profile record', async () => {
    const mockUserId = 'usr-investor-789';
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'inversor@gmail.com' },
        session: null,
      },
      error: null,
    });

    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="investor"
        defaultTermsAccepted={true}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nombre y apellido completo/i), {
      target: { value: 'Gonzalo Fernández' },
    });
    fireEvent.change(screen.getByLabelText(/DNI o CUIT tributario/i), {
      target: { value: '35987654' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'inversor@gmail.com' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'InversorCapital2026' },
    });

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'inversor@gmail.com',
        password: 'InversorCapital2026',
        options: {
          data: {
            role: 'investor',
            legal_name: 'Gonzalo Fernández',
            tax_id: '35987654',
            representative_name: '',
          },
        },
      });
    });

    await waitFor(() => {
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('profiles');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId,
          role: 'investor',
          tax_id: '35987654',
          legal_name: 'Gonzalo Fernández',
          email: 'inversor@gmail.com',
        })
      );
    });

    expect(await screen.findByTestId('registration-confirmation')).toBeInTheDocument();
    expect(screen.getByText('inversor@gmail.com')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 5. Duplicate Email & Server Error Handling
  // ---------------------------------------------------------------------------
  it('displays user-friendly error message when email is already registered', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered', status: 422 },
    });

    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="investor"
        defaultTermsAccepted={true}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nombre y apellido completo/i), {
      target: { value: 'Lucía Benítez' },
    });
    fireEvent.change(screen.getByLabelText(/DNI o CUIT tributario/i), {
      target: { value: '31234567' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'existente@correo.com' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'ClaveSegura2026' },
    });

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(
      await screen.findByText(/Ya existe una cuenta registrada con este correo electrónico/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('registration-confirmation')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // 6. Optional DNI for Investors & Format Validation (Issue #53)
  // ---------------------------------------------------------------------------
  it('allows investor to register without DNI and shows helper text (Issue #53)', async () => {
    const mockUserId = 'usr-inv-nodni';
    mockSignUp.mockResolvedValue({
      data: {
        user: { id: mockUserId, email: 'nodni@lencord.com' },
        session: null,
      },
      error: null,
    });

    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="investor"
        defaultTermsAccepted={true}
      />
    );

    // Helper text is displayed
    expect(
      screen.getByText(/Opcional al registrarse\. Requerido posteriormente para poder invertir\./i)
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nombre y apellido completo/i), {
      target: { value: 'Inversor Sin DNI' },
    });
    // Leave DNI empty!
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'nodni@lencord.com' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'PasswordSegura2026' },
    });

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'nodni@lencord.com',
          options: expect.objectContaining({
            data: expect.objectContaining({
              role: 'investor',
              tax_id: null,
            }),
          }),
        })
      );
    });

    await waitFor(() => {
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUserId,
          role: 'investor',
          tax_id: null,
        })
      );
    });

    expect(await screen.findByTestId('registration-confirmation')).toBeInTheDocument();
  });

  it('validates DNI/CUIT format when entered by investor (Issue #53)', async () => {
    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="investor"
        defaultTermsAccepted={true}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nombre y apellido completo/i), {
      target: { value: 'Inversor Formato' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'formato@lencord.com' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'PasswordSegura2026' },
    });

    // Enter invalid DNI length (5 digits)
    fireEvent.change(screen.getByLabelText(/DNI o CUIT tributario/i), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(
      await screen.findByText(/Ingres[aá] un DNI \(7 u 8 dígitos\) o CUIT \(11 dígitos\) válido/i)
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();

    // Enter invalid 11-digit CUIT checksum
    fireEvent.change(screen.getByLabelText(/DNI o CUIT tributario/i), {
      target: { value: '20-12345678-0' },
    });
    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(
      await screen.findByText(/El CUIT de 11 dígitos no es válido según el algoritmo oficial/i)
    ).toBeInTheDocument();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('renders login redirection guidance when email is already registered', async () => {
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    });

    render(
      <RegisterForm
        supabaseClient={mockSupabaseClient}
        defaultRole="investor"
        defaultTermsAccepted={true}
      />
    );

    fireEvent.change(screen.getByLabelText(/Nombre y apellido completo/i), {
      target: { value: 'Inversor Existente' },
    });
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'existente@lencord.com' },
    });
    fireEvent.change(screen.getByLabelText(/Contraseña/i), {
      target: { value: 'PasswordSegura2026' },
    });

    fireEvent.click(screen.getByTestId('submit-register-btn'));

    expect(await screen.findByTestId('server-error-alert')).toBeInTheDocument();
    expect(screen.getByTestId('login-redirect-link-from-error')).toBeInTheDocument();
    expect(screen.getByTestId('login-redirect-link-from-error')).toHaveAttribute(
      'href',
      expect.stringContaining('/login?email=existente%40lencord.com')
    );
  });
});

