import { useParams } from "react-router-dom";
import Placeholder from "../components/Placeholder";

export default function Join() {
  const { code } = useParams();
  return <Placeholder title={`Join assignment ${code}`} />;
}
