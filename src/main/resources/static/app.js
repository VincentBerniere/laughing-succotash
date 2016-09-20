'use strict';

const React = require('react');
const when = require('when');
const client = require('./client');

const follow = require('./follow'); // function to hop multiple links by "rel"

var stompClient = require('./websocket-listener')

const root = '/api';

class App extends React.Component {

    constructor(props) {
        super(props);
        this.state = {projects: [], attributes: [], page: 1, pageSize: 10, links: {}};
        this.updatePageSize = this.updatePageSize.bind(this);
        this.onCreate = this.onCreate.bind(this);
        this.onDelete = this.onDelete.bind(this);
        this.onUpdate = this.onUpdate.bind(this);
        this.onNavigate = this.onNavigate.bind(this);
        this.refreshCurrentPage = this.refreshCurrentPage.bind(this);
        this.refreshAndGoToLastPage = this.refreshAndGoToLastPage.bind(this);
    }

    loadFromServer(pageSize) {
        follow(client, root, [
            {rel: 'projects', params: {size: pageSize}}]
        ).then(projectCollection => {
            return client({
                method: 'GET',
                path: projectCollection.entity._links.profile.href,
                headers: {'Accept': 'application/schema+json'}
            }).then(schema => {
                this.schema = schema.entity;
                this.links = projectCollection.entity._links;
                return projectCollection;
            });
        }).then(projectCollection => {
            return projectCollection.entity._embedded.projects.map(project =>
                client({
                    method: 'GET',
                    path: project._links.self.href
                })
            );
        }).then(projectPromises => {
            return when.all(projectPromises);
        }).done(projects => {
            this.setState({
                projects: projects,
                attributes: Object.keys(this.schema.properties),
                pageSize: pageSize,
                links: this.links
            });
        });
    }

    onCreate(newProject) {
        follow(client, root, ['projects']).done(response => {
            client({
                method: 'POST',
                path: response.entity._links.self.href,
                entity: newProject,
                headers: {'Content-Type': 'application/json'}
            })
        })
    }

    onDelete(project) {
        client({method: 'DELETE', path: project.entity._links.self.href});
    }

    onUpdate(project, updatedProject) {
        client({
            method: 'PUT',
            path: project.entity._links.self.href,
            entity: updatedProject,
            headers: {
                'Content-Type': 'application/json',
                'If-Match': project.headers.Etag
            }
        }).done(response => {
            /* Let the websocket handler update the state */
        }, response => {
            if (response.status.code === 412) {
                alert('DENIED: Unable to update ' +
                    project.entity._links.self.href + '. Your copy is stale.');
            }
        });
    }

    onNavigate(navUri) {
        client({
            method: 'GET',
            path: navUri
        }).then(projectCollection => {
            this.links = projectCollection.entity._links;
            this.page = projectCollection.entity.page;

            return projectCollection.entity._embedded.projects.map(project =>
                client({
                    method: 'GET',
                    path: project._links.self.href
                })
            );
        }).then(projectPromises => {
            return when.all(projectPromises);
        }).done(projects => {
            this.setState({
                projects: projects,
                attributes: Object.keys(this.schema.properties),
                pageSize: this.state.pageSize,
                links: this.links
            });
        });
    }

    updatePageSize(pageSize) {
        if (pageSize !== this.state.pageSize) {
            this.loadFromServer(pageSize);
        }
    }

    componentDidMount() {
        this.loadFromServer(this.state.pageSize);
        stompClient.register([
            {route: '/topic/newProject', callback: this.refreshAndGoToLastPage},
            {route: '/topic/updateProject', callback: this.refreshCurrentPage},
            {route: '/topic/deleteProject', callback: this.refreshCurrentPage}
        ]);
    }

    refreshAndGoToLastPage(message) {
        follow(client, root, [{
            rel: 'projects',
            params: {size: this.state.pageSize}
        }]).done(response => {
            if (response.entity._links.last !== undefined) {
                this.onNavigate(response.entity._links.last.href);
            } else {
                this.onNavigate(response.entity._links.self.href);
            }
        })
    }

    refreshCurrentPage(message) {
        follow(client, root, [{
            rel: 'projects',
            params: {
                size: this.state.pageSize,
                page: this.state.page.number
            }
        }]).then(projectCollection => {
            this.links = projectCollection.entity._links;
            this.page = projectCollection.entity.page;

            return projectCollection.entity._embedded.projects.map(project => {
                return client({
                    method: 'GET',
                    path: project._links.self.href
                })
            });
        }).then(projectPromises => {
            return when.all(projectPromises);
        }).then(projects => {
            this.setState({
                page: this.page,
                projects: projects,
                attributes: Object.keys(this.schema.properties),
                pageSize: this.state.pageSize,
                links: this.links
            });
        });
    }

    render() {
        return (
            <div className="row col-xs-12">
                <CreateDialog attributes={this.state.attributes} onCreate={this.onCreate}/>

                <ProjectList  page={this.state.page}
                              projects={this.state.projects}
                              links={this.state.links}
                              pageSize={this.state.pageSize}
                              attributes={this.state.attributes}
                              onNavigate={this.onNavigate}
                              onUpdate={this.onUpdate}
                              onDelete={this.onDelete}
                              updatePageSize={this.updatePageSize}/>
            </div>
        )
    }
}


class CreateDialog extends React.Component {

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleSubmit(e) {
        e.preventDefault();
        var newProject = {};
        this.props.attributes.forEach(attribute => {
            newProject[attribute] = React.findDOMNode(this.refs[attribute]).value.trim();
        });
        this.props.onCreate(newProject);

        // clear out the dialog's inputs
        this.props.attributes.forEach(attribute => {
            React.findDOMNode(this.refs[attribute]).value = '';
        });

        // Navigate away from the dialog to hide it.
        window.location = "#";
    }

    dateTimePicker() {
        $('#date').datetimepicker({
            locale: 'fr',
            format: 'DD/MM/YYYY'
        });
    }

    render() {
        var inputs = this.props.attributes.map(attribute =>
            <div key={attribute} className="form-group">
                <label>{attribute}</label>
                <input id={attribute} type="text" ref={attribute} className="form-control" />
            </div>
        );

        return (
            <div className="row col-xs-12">
                <button type="button" onClick={this.dateTimePicker} className="btn btn-info btn-lg" data-toggle="modal" data-target="#addProject">Add project</button>

                <div id="addProject" className="modal fade" role="dialog">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" data-dismiss="modal">&times;</button>
                                <h4 className="modal-title">Add new project</h4>
                            </div>
                            <div className="modal-body">
                                <form>
                                    {inputs}
                                    <div className="form-group">
                                        <button type="submit" className="btn btn-success" data-dismiss="modal" onClick={this.handleSubmit}>Confirm</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
    )
    }
}

class UpdateDialog extends React.Component {

    constructor(props) {
        super(props);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleSubmit(e) {
        e.preventDefault();
        var updatedProject = {};
        this.props.attributes.forEach(attribute => {
            updatedProject[attribute] = React.findDOMNode(this.refs[attribute]).value.trim();
        });
        this.props.onUpdate(this.props.project, updatedProject);
        window.location = "#";
    }

    dateTimePicker() {
        $('#date_update').datetimepicker({
            locale: 'fr',
            format: 'DD/MM/YYYY'
        });
    }

    render() {
        var inputs = this.props.attributes.map(attribute =>
            <div className="form-group" key={this.props.project.entity[attribute]}>
                <input id={attribute+"_update"} type="text" placeholder={attribute}
                       defaultValue={this.props.project.entity[attribute]}
                       ref={attribute} className="form-control" />
            </div>
        );

        var id = this.props.project.entity._links.self.href.split('/');
        console.log('id : ' + id[id.length-1]);
        var dialogId = "updateProject-" + id[id.length-1];

        return (
            <div className="row col-xs-12" key={this.props.project.entity._links.self.href}>
                <button type="button" onClick={this.dateTimePicker} className="btn btn-primary" data-toggle="modal" data-target={"#" + dialogId}>Update</button>

                <br/>

                <div id={dialogId} className="modal fade" role="dialog">
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <button type="button" className="close" data-dismiss="modal">&times;</button>
                                <h4 className="modal-title">Update project</h4>
                            </div>

                            <div className="modal-body">
                                <form>
                                    {inputs}
                                    <div className="form-group">
                                        <button type="submit" className="btn btn-success" data-dismiss="modal" onClick={this.handleSubmit}>Update</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
};


class ProjectList extends React.Component{

    constructor(props) {
        super(props);
        this.handleNavFirst = this.handleNavFirst.bind(this);
        this.handleNavPrev = this.handleNavPrev.bind(this);
        this.handleNavNext = this.handleNavNext.bind(this);
        this.handleNavLast = this.handleNavLast.bind(this);
        this.handleInput = this.handleInput.bind(this);
    }

    // tag::handle-page-size-updates[]
    handleInput(e) {
        e.preventDefault();
        var pageSize = React.findDOMNode(this.refs.pageSize).value;
        if (/^[0-9]+$/.test(pageSize)) {
            this.props.updatePageSize(pageSize);
        } else {
            React.findDOMNode(this.refs.pageSize).value =
                pageSize.substring(0, pageSize.length - 1);
        }
    }

    // tag::handle-nav[]
    handleNavFirst(e){
        e.preventDefault();
        this.props.onNavigate(this.props.links.first.href);
    }

    handleNavPrev(e) {
        e.preventDefault();
        this.props.onNavigate(this.props.links.prev.href);
    }

    handleNavNext(e) {
        e.preventDefault();
        this.props.onNavigate(this.props.links.next.href);
    }

    handleNavLast(e) {
        e.preventDefault();
        this.props.onNavigate(this.props.links.last.href);
    }
    // end::handle-nav[]

    render() {
        var pageInfo = this.props.page.hasOwnProperty("number") ?
            <label>Projects - Page {this.props.page.number + 1} of {this.props.page.totalPages}</label> : null;

        var projects = this.props.projects.map(project =>
            <Project key={project.entity._links.self.href} project={project} attributes={this.props.attributes}
                     onUpdate={this.props.onUpdate} onDelete={this.props.onDelete}/>
        );

        var navLinks = [];

        if ("first" in this.props.links) {
            navLinks.push(<button key="first" onClick={this.handleNavFirst}>&lt;&lt;</button>);
        }
        if ("prev" in this.props.links) {
            navLinks.push(<button key="prev" onClick={this.handleNavPrev}>&lt;</button>);
        }
        if ("next" in this.props.links) {
            navLinks.push(<button key="next" onClick={this.handleNavNext}>&gt;</button>);
        }
        if ("last" in this.props.links) {
            navLinks.push(<button key="last" onClick={this.handleNavLast}>&gt;&gt;</button>);
        }

        return (
            <div className="row col-xs-12">
                <div className="row col-xs-12 col-sm-6 col-md-4">
                    <div className="form-group">
                        {pageInfo}
                        <input className="form-control" ref="pageSize" defaultValue={this.props.pageSize} onInput={this.handleInput}/>
                    </div>
                </div>

                <div className="row col-xs-12">
                    <div className="table-responsive">
                        <table className="table table-bordered table-hover">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Description</th>
                                    <th>Link</th>
                                    <th>ImageLink</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            {projects}
                        </table>
                        <div className="row col-xs-12">
                            {navLinks}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

class Project extends React.Component{
    constructor(props) {
        super(props);
        this.handleDelete = this.handleDelete.bind(this);
    }

    handleDelete() {
        this.props.onDelete(this.props.project);
    }

    render() {
        return (
            <tr>
                <td>{this.props.project.entity.name}</td>
                <td>{this.props.project.entity.description}</td>
                <td>{this.props.project.entity.link}</td>
                <td><img className="img-responsive" src={this.props.project.entity.imageLink} alt="project image"/></td>
                <td>{this.props.project.entity.date}</td>
                <td>
                    <UpdateDialog project={this.props.project} attributes={this.props.attributes} onUpdate={this.props.onUpdate}/>
                    <button className="btn btn-danger" onClick={this.handleDelete}>Delete</button>
                </td>
            </tr>
        )
    }
}

React.render(
    <App />,
    document.getElementById('react')
)