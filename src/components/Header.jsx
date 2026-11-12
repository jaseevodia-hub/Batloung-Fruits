
function Header() {
  return (
    <header className="app-header">
      <div className="header-user">
        <div className="user-avatar">A</div>
        <div>
          <strong>Administrator</strong>
          <p>System Manager</p>
        </div>
      </div>

      <div className="header-welcome">
        <h2>Batloung Fruits Distribution</h2>
        <p>Management System</p>
      </div>
    </header>
  );
}

export default Header;