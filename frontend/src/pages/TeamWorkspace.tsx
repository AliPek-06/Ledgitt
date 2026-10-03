import { useParams } from "react-router-dom";
import Placeholder from "../components/Placeholder";

export default function TeamWorkspace() {
  const { teamId } = useParams();
  return <Placeholder title={`Team ${teamId} workspace`} />;
}
