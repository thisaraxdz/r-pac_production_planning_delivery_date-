const CLASS_BY_STATUS = {
  "Met": "tag-met",
  "At risk": "tag-risk",
  "Not met": "tag-not-met",
}

// "label" is optional. If it is not given, the status word itself is shown.
function StatusTag({ status, label }) {
  return <span className={`tag ${CLASS_BY_STATUS[status]}`}>{label ?? status}</span>
}

export default StatusTag