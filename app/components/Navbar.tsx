import {Link} from "react-router";

const Navbar = () => {
    return (
        <nav className="navbar">
            <Link to="/" className="flex items-center no-underline">
                <p className="text-2xl font-bold text-gradient m-0">RESUMEAI</p>
            </Link>
            <Link 
                to="/builder" 
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-base px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 whitespace-nowrap no-underline"
            >
                Get started free
            </Link>
        </nav>
    )
}
export default Navbar
