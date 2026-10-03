import { useParams } from "react-router-dom";
import Placeholder from "../components/Placeholder";

export default function TeamCharter() {
  const { teamId } = useParams();
  return <Placeholder title={`Team ${teamId} charter`} />;
}
