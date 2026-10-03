import { useParams } from "react-router-dom";
import Placeholder from "../components/Placeholder";

export default function TeacherAssignment() {
  const { assignmentId } = useParams();
  return <Placeholder title={`Assignment ${assignmentId}`} />;
}
