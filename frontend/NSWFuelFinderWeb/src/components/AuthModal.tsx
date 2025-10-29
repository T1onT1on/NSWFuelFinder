import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Input, Modal, Space, Tabs, Typography, message } from "antd";
import { loginUser, registerUser, type LoginPayload, type AuthTokenResponse, extractErrorMessage } from "../api/auth";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: (tokens: AuthTokenResponse) => void;
};

type TabKey = "login" | "register";

export const AuthModal: React.FC<AuthModalProps> = ({ open, onClose, onLoginSuccess }) => {
  const [activeTab, setActiveTab] = useState<TabKey>("login");
  const [loginForm] = Form.useForm<LoginPayload>();
  const [registerForm] = Form.useForm<LoginPayload>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      loginForm.resetFields();
      registerForm.resetFields();
      setIsSubmitting(false);
      setErrorMessage(null);
      return;
    }

    loginForm.setFieldsValue({ email: "", password: "" });
    registerForm.setFieldsValue({ email: "", password: "" });
  }, [open, loginForm, registerForm]);

  const handleLogin = useCallback(
    async (values: LoginPayload) => {
      try {
        setIsSubmitting(true);
        setErrorMessage(null);
        const response = await loginUser(values);
        onLoginSuccess(response);
        onClose();
      } catch (error) {
        setErrorMessage(extractErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [onClose, onLoginSuccess]
  );

  const handleRegister = useCallback(
    async (values: LoginPayload) => {
      try {
        setIsSubmitting(true);
        setErrorMessage(null);
        await registerUser(values);
        message.success({ key: "auth-message", content: "Sign-up successful. You can now log in." });
        setActiveTab("login");
        loginForm.setFieldsValue({ email: values.email, password: values.password });
      } catch (error) {
        setErrorMessage(extractErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
    [loginForm]
  );

  const tabItems = useMemo(
    () => [
      {
        key: "login",
        label: "Log In",
        children: (
          <Form<LoginPayload> form={loginForm} layout="vertical" onFinish={handleLogin} requiredMark={false}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Please enter your email." },
                { type: "email", message: "Please enter a valid email address." },
              ]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Please enter your password." }]}
            >
              <Input.Password placeholder="Enter Password" autoComplete="current-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={isSubmitting}>
                Log In
              </Button>
            </Form.Item>
          </Form>
        ),
      },
      {
        key: "register",
        label: "Sign Up",
        children: (
          <Form<LoginPayload> form={registerForm} layout="vertical" onFinish={handleRegister} requiredMark={false}>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Please enter your email." },
                { type: "email", message: "Please enter a valid email address." },
              ]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Please enter a password." },
                { min: 6, message: "Password must be at least 6 characters." },
              ]}
            >
              <Input.Password placeholder="Set Password" autoComplete="new-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block loading={isSubmitting}>
                Create Account
              </Button>
            </Form.Item>
          </Form>
        ),
      },
    ],
    [handleLogin, handleRegister, isSubmitting, loginForm, registerForm]
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnClose
      width={420}
      title={null}
      bodyStyle={{ padding: "32px 32px 24px" }}
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <div style={{ textAlign: "center" }}>
          <Typography.Title level={3} style={{ marginBottom: 8 }}>
            Welcome back
          </Typography.Title>
          <Typography.Text type="secondary">Sign in or create an account to sync preferences and favourites.</Typography.Text>
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as TabKey);
            setErrorMessage(null);
          }}
          items={tabItems}
          centered
        />
        {errorMessage && <Alert type="error" showIcon message={errorMessage} />}
      </Space>
    </Modal>
  );
};
