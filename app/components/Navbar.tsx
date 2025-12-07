import {Link} from "react-router";

const Navbar = () => {
    return (
        <nav className="navbar">
            <Link to="/" className="flex items-center no-underline">
                <p className="text-2xl font-bold text-gradient m-0">RESUMIND</p>
            </Link>
            <Link to="/upload" className="primary-button w-fit whitespace-nowrap no-underline">
                Upload Resume
            </Link>
        </nav>
    )
}
export default Navbar
