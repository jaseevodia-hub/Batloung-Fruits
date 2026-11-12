
function StatCard({ title, value, description, icon, tone = "green" }) {
  return (
    <div className="stat-card">
      {icon && (
        <span className={`stat-card-icon tone-${tone}`} aria-hidden="true">
          {icon}
        </span>
      )}

      <div className="stat-card-info">
        <p className="stat-card-title">{title}</p>
        <h3 className="stat-card-value">{value}</h3>

        {description && (
          <p className="stat-card-description">{description}</p>
        )}
      </div>
    </div>
  );
}

export default StatCard;