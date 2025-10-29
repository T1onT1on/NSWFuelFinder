import { useMemo, useState } from "react";
import { Layout, Menu, Typography, Button, Space, message } from "antd";
import { DashboardOutlined, EnvironmentOutlined, LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthModal } from "../components/AuthModal";
import type { AuthTokenResponse } from "../api/auth";

const { Header, Content, Footer, Sider } = Layout;

const menuItems = [
  {
    key: "overview",
    icon: <DashboardOutlined />,
    label: <Link to="/">Overview</Link>,
    path: "/",
  },
  {
    key: "nearby",
    icon: <EnvironmentOutlined />,
    label: <Link to="/nearby">Find Stations</Link>,
    path: "/nearby",
  },
];

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, setSession, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const selectedKeys = useMemo(() => {
    const match = menuItems.find((item) => {
      if (item.path === "/nearby") {
        return location.pathname.startsWith("/nearby");
      }
      return location.pathname === item.path;
    });
    return match ? [match.key] : [menuItems[0].key];
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    message.info({ key: "auth-message", content: "Signed out." });
  };

  const handleLoginSuccess = (tokens: AuthTokenResponse) => {
    setSession(tokens);
    setAuthModalOpen(false);
    message.success({ key: "auth-message", content: "Signed in successfully." });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="logo" style={{ padding: "16px", textAlign: "center" }}>
          <Typography.Title level={4} style={{ color: "white", margin: 0 }}>
            Pannels
          </Typography.Title>
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={selectedKeys} items={menuItems} />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", padding: "0 24px" }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Typography.Title level={3} style={{ margin: 0 }}>
              NSW Fuel Finder
            </Typography.Title>
            <div>
              {isAuthenticated ? (
                <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                  Log Out
                </Button>
              ) : (
                <Button type="primary" icon={<LoginOutlined />} onClick={() => setAuthModalOpen(true)}>
                  Log In / Register
                </Button>
              )}
            </div>
          </Space>
        </Header>
        <Content style={{ margin: "24px" }}>
          <Outlet />
        </Content>
        <Footer style={{ textAlign: "center" }}>
          NSW Fuel Finder © {new Date().getFullYear()} · Built with React & Ant Design
        </Footer>
      </Layout>
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} onLoginSuccess={handleLoginSuccess} />
    </Layout>
  );
};
